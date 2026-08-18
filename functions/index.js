const { setGlobalOptions } = require("firebase-functions");
const { onCall, onRequest, HttpsError } =
  require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } =
  require("firebase-admin/firestore");
const crypto = require("crypto");
const CROCHETER_NAMES = require("./crocheters");

const projectId =
  process.env.GCLOUD_PROJECT ||
  process.env.GCP_PROJECT ||
  "review-monster-80750";

initializeApp({ projectId });
setGlobalOptions({ maxInstances: 10, region: "us-central1" });

let db;

const MAX_LIMIT = 100;
const ALLOWED_PUBLIC_ORIGINS = new Set([
  "http://localhost:5173",
  "https://review-monster-80750.web.app",
  "https://review-monster-80750.firebaseapp.com",
  "https://sulci.co.jp",
  "https://shopify.sulci.co.jp",
  "https://sulciglobal.com",
]);

/**
 * Returns normalized origin string for whitelist comparison.
 * @param {string|undefined} value Raw origin header.
 * @return {string}
 */
function normalizeOrigin(value) {
  if (!value || typeof value !== "string") return "";
  try {
    return new URL(value).origin.toLowerCase();
  } catch (error) {
    return "";
  }
}

/**
 * Parses an integer query parameter with bounds.
 * @param {unknown} value Raw query parameter value.
 * @param {number} fallback Default value.
 * @param {number} min Minimum allowed value.
 * @param {number} max Maximum allowed value.
 * @return {number}
 */
function parseIntParam(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const rounded = Math.floor(n);
  return Math.max(min, Math.min(max, rounded));
}

/**
 * In-place Fisher-Yates shuffle.
 * @param {Array<object>} list Input list.
 * @return {Array<object>}
 */
function shuffle(list) {
  const clone = Array.isArray(list) ? list.slice() : [];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = clone[i];
    clone[i] = clone[j];
    clone[j] = temp;
  }
  return clone;
}

/**
 * Sets CORS headers for storefront GET usage.
 * @param {object} req Express request.
 * @param {object} res Express response.
 * @return {boolean} true when handled as preflight.
 */
function applyPublicCors(req, res) {
  const originHeader = req.get("origin");
  const origin = normalizeOrigin(originHeader);
  const isAllowedOrigin = !origin || ALLOWED_PUBLIC_ORIGINS.has(origin);

  if (origin && isAllowedOrigin) {
    res.set("Access-Control-Allow-Origin", origin);
  }
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    if (!isAllowedOrigin) {
      res.status(403).send("");
      return true;
    }
    res.status(204).send("");
    return true;
  }

  if (!isAllowedOrigin) {
    res.status(403).json({ error: "Origin not allowed" });
    return true;
  }

  return false;
}

/**
 * Lazily creates and reuses a Firestore client.
 * Avoids expensive startup work during function discovery.
 * @return {object} Firestore client instance.
 */
function getDb() {
  if (!db) {
    db = getFirestore();
  }
  return db;
}

/**
 * submitReviewByToken
 *
 * Callable function used by the public review form.
 * Validates the token, creates the review, and marks the
 * request used — all inside a Firestore transaction.
 *
 * Frontend usage:
 *   import { getFunctions, httpsCallable } from 'firebase/functions';
 *   const fn = httpsCallable(getFunctions(), 'submitReviewByToken');
 *   const { data } = await fn({ token, ...formFields });
 *   // data → { success, reviewId, couponEnabled,
 *   //           couponCode, thankYouMessage }
 */
exports.submitReviewByToken = onCall(async (request) => {
  const db = getDb();

  const {
    token,
    reviewerName,
    reviewerEmail,
    rating,
    title,
    body,
    crocheterName,
    permissionGranted,
    language,
    pictureUrls: rawPictureUrls,
    website,
    formLoadedAt,
  } = request.data;

  // Honeypot: bots that fill hidden fields get a silent no-op response.
  if (website && String(website).trim().length > 0) {
    return {
      success: true, reviewId: null,
      couponEnabled: false, couponCode: "", thankYouMessage: "",
    };
  }

  // Timing check: reject submissions under 3 seconds (likely automated).
  if (typeof formLoadedAt === "number" && Date.now() - formLoadedAt < 3000) {
    throw new HttpsError("invalid-argument", "Please try again.");
  }

  const normalizedLanguage = String(language || "")
    .toLowerCase()
    .startsWith("ja") ? "ja" : "en";
  const reviewBody = String(body || "").trim();
  const reviewRating = Number(rating) || 5;
  const reviewerNameTrimmed = String(reviewerName || "").trim();
  const URL_RE = /https?:\/\/|www\./i;

  // Input validation
  if (!token || typeof token !== "string") {
    throw new HttpsError("invalid-argument", "token is required");
  }
  if (
    !reviewerNameTrimmed ||
    reviewerNameTrimmed.length < 2 ||
    reviewerNameTrimmed.length > 60 ||
    URL_RE.test(reviewerNameTrimmed)
  ) {
    throw new HttpsError("invalid-argument", "Display name is invalid");
  }
  if (
    !reviewBody || reviewBody.length < 10 ||
    reviewBody.length > 2000 || URL_RE.test(reviewBody)
  ) {
    throw new HttpsError("invalid-argument", "Review body is invalid");
  }
  if (reviewRating < 1 || reviewRating > 5) {
    throw new HttpsError("invalid-argument", "Rating must be between 1 and 5");
  }

  // Crocheter name must be from the approved whitelist.
  const crocheterTrimmed = String(crocheterName || "").trim();
  if (!CROCHETER_NAMES.includes(crocheterTrimmed)) {
    throw new HttpsError(
      "invalid-argument", "Please select a valid crocheter name");
  }

  const STORAGE_URL_RE = /^https:\/\/firebasestorage\.googleapis\.com\//;
  const validatedPictureUrls = Array.isArray(rawPictureUrls) ?
    rawPictureUrls.filter((u) => typeof u === "string" && u.length > 0) :
    [];
  if (validatedPictureUrls.length > 3) {
    throw new HttpsError("invalid-argument", "Maximum 3 images allowed");
  }
  if (validatedPictureUrls.some(
    (u) => !STORAGE_URL_RE.test(u) || u.length > 2000,
  )) {
    throw new HttpsError("invalid-argument", "Invalid image URL");
  }

  // Look up the review request by token
  const reqSnap = await db
    .collection("reviewRequests")
    .where("token", "==", token)
    .limit(1)
    .get();

  if (reqSnap.empty) {
    throw new HttpsError("not-found", "Invalid review link");
  }

  const reqDoc = reqSnap.docs[0];
  const reqData = reqDoc.data();

  if (reqData.active === false) {
    throw new HttpsError(
      "failed-precondition",
      "This review link is no longer accepting reviews");
  }

  // Rate limiting: block same IP+token within 24 hours.
  const rawReq = request.rawRequest || {};
  const forwardedFor =
    (rawReq.headers && rawReq.headers["x-forwarded-for"]) || "";
  const ip = forwardedFor.split(",")[0].trim() || rawReq.ip || "";
  const ipHash = crypto.createHash("sha256").update(ip + token).digest("hex");
  const since = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
  const logSnap = await db
    .collection("reviewSubmissionLogs")
    .where("ipHash", "==", ipHash)
    .where("createdAt", ">=", since)
    .limit(1)
    .get();

  if (!logSnap.empty) {
    throw new HttpsError(
      "resource-exhausted",
      "You have already submitted a review recently. Thank you!",
    );
  }

  // Read settings for the store owner
  const settingsSnap = reqData.uid ?
    await db.collection("settings").doc(reqData.uid).get() :
    null;
  const settings = (settingsSnap && settingsSnap.exists) ?
    settingsSnap.data() : {};
  const requestCouponCode = String(reqData.couponCode || "").trim();
  const settingsCouponCode = settings.couponEnabled ?
    String(settings.couponCode || "").trim() : "";
  const resolvedCouponCode = requestCouponCode || settingsCouponCode;

  // Write review + rate-limit log entry atomically
  const reviewRef = db.collection("reviews").doc();
  const logRef = db.collection("reviewSubmissionLogs").doc();

  await db.runTransaction(async (tx) => {
    // Re-check active flag to guard against concurrent deactivation.
    const freshReq = await tx.get(reqDoc.ref);
    if (!freshReq.exists || freshReq.data().active === false) {
      throw new HttpsError(
        "failed-precondition",
        "This review link is no longer accepting reviews");
    }

    tx.set(reviewRef, {
      uid: reqData.uid || null,
      reviewerName: reviewerNameTrimmed,
      reviewerEmail: reviewerEmail || "",
      rating: reviewRating,
      title: title || "",
      body: reviewBody,
      bodyJa: normalizedLanguage === "ja" ? reviewBody : "",
      bodyEn: normalizedLanguage === "en" ? reviewBody : "",
      reviewLanguage: normalizedLanguage,
      reviewDate: FieldValue.serverTimestamp(),
      permissionGranted: permissionGranted === true,
      pictureUrls: validatedPictureUrls,
      productHandle: reqData.productHandle || "",
      productTitle: reqData.productTitle || "",
      crocheterName: crocheterTrimmed,
      source: "qr_form",
      status: settings.defaultReviewStatus || "draft",
      verified: false,
      exportedToJudgeMe: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(logRef, {
      token,
      ipHash,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  // Best-effort submission counter increment for admin visibility.
  db.collection("reviewRequests").doc(reqDoc.id)
    .update({
      submissionCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    }).catch(() => { });

  return {
    success: true,
    reviewId: reviewRef.id,
    couponEnabled: !!resolvedCouponCode,
    couponCode: resolvedCouponCode,
    thankYouMessage: settings.thankYouMessage || "",
  };
});

/**
 * publicReviews
 *
 * Public HTTP endpoint for Shopify storefront rendering.
 * Returns a small, random subset of approved reviews.
 *
 * Query params:
 *   uid: required owner uid
 *   productHandle: optional string
 *   limit: optional integer (1..100, default 6)
 */
exports.publicReviews = onRequest(async (req, res) => {
  if (applyPublicCors(req, res)) return;

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const db = getDb();
    const uid = String(req.query.uid || "").trim();
    const productHandle = String(req.query.productHandle || "").trim();
    const normalizedHandle = productHandle.toLowerCase();
    const limit = parseIntParam(req.query.limit, 6, 1, MAX_LIMIT);
    const poolLimit = parseIntParam(req.query.poolLimit, 30, limit, 100);

    if (!uid) {
      res.status(400).json({ error: "uid is required" });
      return;
    }

    const fetchLimit = Math.max(60, Math.min(200, poolLimit * 4));
    const snap = await db.collection("reviews")
      .where("uid", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(fetchLimit)
      .get();

    const allEligibleItems = snap.docs.map((doc) => {
      const data = doc.data();
      const pictureUrls = Array.isArray(data.pictureUrls) ?
        data.pictureUrls : [];
      const firstPicture = typeof pictureUrls[0] === "string" ?
        pictureUrls[0].trim() : "";
      const postcard = typeof data.postcardImageUrl === "string" ?
        data.postcardImageUrl.trim() : "";

      return {
        id: doc.id,
        reviewerName: String(data.reviewerName || "").trim(),
        rating: Number(data.rating) || 0,
        productTitle: String(data.productTitle || "").trim(),
        shortQuoteJa: String(data.shortQuoteJa || "").trim(),
        shortQuoteEn: String(data.shortQuoteEn || "").trim(),
        translationEn: String(data.translationEn || "").trim(),
        cleanedTextJa: String(data.cleanedTextJa || "").trim(),
        body: String(data.body || "").trim(),
        postcardImageUrl: postcard,
        firstPictureUrl: firstPicture,
        permissionGranted: data.permissionGranted === true,
        status: String(data.status || "").trim().toLowerCase(),
        productHandle: String(data.productHandle || "").trim(),
        normalizedProductHandle: String(data.productHandle || "")
          .trim()
          .toLowerCase(),
      };
    }).filter((item) => {
      if (!item.permissionGranted) return false;
      if (item.status !== "ready" && item.status !== "published") return false;

      const hasImage = !!(item.postcardImageUrl || item.firstPictureUrl);
      const hasText = !!(
        item.shortQuoteJa ||
        item.shortQuoteEn ||
        item.translationEn ||
        item.cleanedTextJa ||
        item.body
      );
      return hasImage && hasText;
    });

    const productMatchedItems = normalizedHandle ?
      allEligibleItems.filter(
        (item) => item.normalizedProductHandle === normalizedHandle,
      ) :
      [];
    const sourceItems = productMatchedItems.length > 0 ?
      productMatchedItems :
      allEligibleItems;

    const selected = shuffle(sourceItems).slice(0, limit);

    res.set("Cache-Control", "public, max-age=300, s-maxage=300");
    res.status(200).json({
      count: selected.length,
      uid,
      productHandle,
      matchedProductCount: productMatchedItems.length,
      reviews: selected,
    });
  } catch (error) {
    console.error("publicReviews failed", error);
    res.status(500).json({ error: "Failed to load public reviews" });
  }
});

