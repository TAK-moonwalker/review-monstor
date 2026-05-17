const {setGlobalOptions} = require("firebase-functions");
const {onCall, onRequest, HttpsError} = require("firebase-functions/v2/https");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");

const projectId =
  process.env.GCLOUD_PROJECT ||
  process.env.GCP_PROJECT ||
  "review-monster-80750";

initializeApp({projectId});
setGlobalOptions({maxInstances: 10, region: "us-central1"});

let db;

const MAX_LIMIT = 30;
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
    res.status(403).json({error: "Origin not allowed"});
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
    permissionGranted,
  } = request.data;

  // Input validation
  if (!token || typeof token !== "string") {
    throw new HttpsError("invalid-argument", "token is required");
  }
  if (!body || typeof body !== "string" || body.trim().length === 0) {
    throw new HttpsError("invalid-argument", "Review body is required");
  }
  if (!rating || typeof rating !== "number" ||
      rating < 1 || rating > 5) {
    throw new HttpsError(
        "invalid-argument", "Rating must be between 1 and 5");
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

  if (reqData.used === true) {
    throw new HttpsError(
        "failed-precondition",
        "This review link has already been used");
  }

  if (reqData.expiresAt) {
    const expires = reqData.expiresAt.toDate ?
      reqData.expiresAt.toDate() :
      new Date(reqData.expiresAt);
    if (expires < new Date()) {
      throw new HttpsError(
          "failed-precondition",
          "This review link has expired");
    }
  }

  // Read settings for the store owner (identified by uid on the review request)
  const settingsSnap = reqData.uid ?
    await db.collection("settings").doc(reqData.uid).get() :
    null;
  const settings = (settingsSnap && settingsSnap.exists) ?
    settingsSnap.data() : {};

  // Atomic write: create review + mark request used
  const reviewRef = db.collection("reviews").doc();

  await db.runTransaction(async (tx) => {
    // Re-read inside transaction to prevent race conditions
    const freshReq = await tx.get(reqDoc.ref);
    if (!freshReq.exists || freshReq.data().used === true) {
      throw new HttpsError(
          "failed-precondition",
          "This review link has already been used");
    }

    tx.set(reviewRef, {
      uid: reqData.uid || null,
      reviewerName: reviewerName || "",
      reviewerEmail: reviewerEmail || "",
      rating,
      title: title || "",
      body: body.trim(),
      permissionGranted: permissionGranted === true,
      productHandle: reqData.productHandle || "",
      productTitle: reqData.productTitle || "",
      source: "qr_form",
      status: settings.defaultReviewStatus || "draft",
      verified: false,
      exportedToJudgeMe: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.update(reqDoc.ref, {
      used: true,
      submittedReviewId: reviewRef.id,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return {
    success: true,
    reviewId: reviewRef.id,
    couponEnabled: settings.couponEnabled === true,
    couponCode: settings.couponEnabled ?
      (settings.couponCode || "") : "",
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
 *   productHandle: optional string
 *   limit: optional integer (1..30, default 6)
 */
exports.publicReviews = onRequest(async (req, res) => {
  if (applyPublicCors(req, res)) return;

  if (req.method !== "GET") {
    res.status(405).json({error: "Method not allowed"});
    return;
  }

  try {
    const db = getDb();
    const productHandle = String(req.query.productHandle || "").trim();
    const normalizedHandle = productHandle.toLowerCase();
    const limit = parseIntParam(req.query.limit, 6, 1, MAX_LIMIT);
    const poolLimit = parseIntParam(req.query.poolLimit, 30, limit, 100);

    const fetchLimit = Math.max(60, Math.min(200, poolLimit * 4));
    const snap = await db.collection("reviews")
        .orderBy("updatedAt", "desc")
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
      productHandle,
      matchedProductCount: productMatchedItems.length,
      reviews: selected,
    });
  } catch (error) {
    console.error("publicReviews failed", error);
    res.status(500).json({error: "Failed to load public reviews"});
  }
});

