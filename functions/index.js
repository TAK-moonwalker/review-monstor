const { setGlobalOptions } = require("firebase-functions");
const { onCall, onRequest, HttpsError } =
  require("firebase-functions/v2/https");
const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } =
  require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const crypto = require("crypto");
const sharp = require("sharp");
const CROCHETER_NAMES = require("./crocheters");

const projectId =
  process.env.GCLOUD_PROJECT ||
  process.env.GCP_PROJECT ||
  "review-monster-80750";

initializeApp({ projectId });
setGlobalOptions({ maxInstances: 10, region: "us-central1" });

let db;

const MAX_LIMIT = 100;
const MAX_UPLOAD_BYTES = 5033165; // 4.8 MB, must match storage.rules
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

// Bilingual error copy for submitReviewByToken, keyed by error id.
const SUBMIT_REVIEW_ERRORS = {
  tryAgain: { en: "Please try again.", ja: "もう一度お試しください。" },
  tokenRequired: { en: "token is required", ja: "トークンが必要です。" },
  invalidName: {
    en: "Display name is invalid",
    ja: "お名前が正しくありません（2〜60文字、URL不可）",
  },
  invalidBody: {
    en: "Review body is invalid",
    ja: "レビュー内容が正しくありません（10〜2000文字、URL不可）",
  },
  invalidRating: {
    en: "Rating must be between 1 and 5",
    ja: "評価は1〜5の範囲で選択してください。",
  },
  tooManyImages: {
    en: "Maximum 3 images allowed",
    ja: "画像は最大3枚までです。",
  },
  invalidImageUrl: {
    en: "Invalid image URL",
    ja: "画像のURLが正しくありません。",
  },
  invalidLink: { en: "Invalid review link", ja: "レビューリンクが無効です。" },
  linkClosed: {
    en: "This review link is no longer accepting reviews",
    ja: "このレビューリンクは現在レビューを受け付けていません。",
  },
  invalidCrocheter: {
    en: "Please select a valid crocheter name",
    ja: "有効な編み子さんのお名前を選択してください。",
  },
  rateLimited: {
    en: "You cannot post a review within 24 hours of your previous review.",
    ja: "前回のレビューから24時間以内は新しいレビューを投稿できません。",
  },
};

/**
 * Looks up a bilingual error message for submitReviewByToken.
 * @param {string} lang Normalized language, "en" or "ja".
 * @param {string} key Key into SUBMIT_REVIEW_ERRORS.
 * @return {string} Localized message.
 */
function submitReviewError(lang, key) {
  const entry = SUBMIT_REVIEW_ERRORS[key];
  return (lang === "ja" && entry.ja) || entry.en;
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
    productTitle,
    productHandle,
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

  const normalizedLanguage = String(language || "")
    .toLowerCase()
    .startsWith("ja") ? "ja" : "en";

  // Timing check: reject submissions under 3 seconds (likely automated).
  if (typeof formLoadedAt === "number" && Date.now() - formLoadedAt < 3000) {
    throw new HttpsError(
      "invalid-argument", submitReviewError(normalizedLanguage, "tryAgain"));
  }

  const reviewBody = String(body || "").trim();
  const reviewRating = Number(rating) || 5;
  const reviewerNameTrimmed = String(reviewerName || "").trim();
  const URL_RE = /https?:\/\/|www\./i;

  // Input validation
  if (!token || typeof token !== "string") {
    throw new HttpsError(
      "invalid-argument",
      submitReviewError(normalizedLanguage, "tokenRequired"));
  }
  if (
    !reviewerNameTrimmed ||
    reviewerNameTrimmed.length < 2 ||
    reviewerNameTrimmed.length > 60 ||
    URL_RE.test(reviewerNameTrimmed)
  ) {
    throw new HttpsError(
      "invalid-argument", submitReviewError(normalizedLanguage, "invalidName"));
  }
  if (
    !reviewBody || reviewBody.length < 10 ||
    reviewBody.length > 2000 || URL_RE.test(reviewBody)
  ) {
    throw new HttpsError(
      "invalid-argument", submitReviewError(normalizedLanguage, "invalidBody"));
  }
  if (reviewRating < 1 || reviewRating > 5) {
    throw new HttpsError(
      "invalid-argument",
      submitReviewError(normalizedLanguage, "invalidRating"));
  }

  const STORAGE_URL_RE = /^https:\/\/firebasestorage\.googleapis\.com\//;
  const validatedPictureUrls = Array.isArray(rawPictureUrls) ?
    rawPictureUrls.filter((u) => typeof u === "string" && u.length > 0) :
    [];
  if (validatedPictureUrls.length > 3) {
    throw new HttpsError(
      "invalid-argument",
      submitReviewError(normalizedLanguage, "tooManyImages"));
  }
  if (validatedPictureUrls.some(
    (u) => !STORAGE_URL_RE.test(u) || u.length > 2000,
  )) {
    throw new HttpsError(
      "invalid-argument",
      submitReviewError(normalizedLanguage, "invalidImageUrl"));
  }

  // Look up the review request by token
  const reqSnap = await db
    .collection("reviewRequests")
    .where("token", "==", token)
    .limit(1)
    .get();

  if (reqSnap.empty) {
    throw new HttpsError(
      "not-found", submitReviewError(normalizedLanguage, "invalidLink"));
  }

  const reqDoc = reqSnap.docs[0];
  const reqData = reqDoc.data();

  if (reqData.active === false) {
    throw new HttpsError(
      "failed-precondition",
      submitReviewError(normalizedLanguage, "linkClosed"));
  }

  // Read settings for the store owner
  const settingsSnap = reqData.uid ?
    await db.collection("settings").doc(reqData.uid).get() :
    null;
  const settings = (settingsSnap && settingsSnap.exists) ?
    settingsSnap.data() : {};

  // Crocheter name must be in the approved list (settings or fallback)
  const hasCustomCrocheters =
    Array.isArray(settings.crocheterList) &&
    settings.crocheterList.length > 0;
  const allowedCrocheters = hasCustomCrocheters ?
    settings.crocheterList :
    CROCHETER_NAMES;
  const crocheterTrimmed = String(crocheterName || "").trim();
  if (
    !crocheterTrimmed ||
    (allowedCrocheters.length > 0 &&
      !allowedCrocheters.includes(crocheterTrimmed))
  ) {
    throw new HttpsError(
      "invalid-argument",
      submitReviewError(normalizedLanguage, "invalidCrocheter"));
  }

  const resolvedProductTitle = String(
    productTitle || reqData.productTitle || "",
  ).trim();
  const resolvedProductHandle = String(
    productHandle || reqData.productHandle || "",
  ).trim();

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
      submitReviewError(normalizedLanguage, "rateLimited"),
    );
  }

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
        submitReviewError(normalizedLanguage, "linkClosed"));
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
      productHandle: resolvedProductHandle,
      productTitle: resolvedProductTitle,
      crocheterName: crocheterTrimmed,
      source: "qr",
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

/**
 * processReviewImage
 *
 * Storage trigger: fires when a raw photo lands under
 * review-images/uploads/{uploadId}.{ext}. Converts it into two WebP
 * derivatives (display + thumbnail), uploads them under
 * review-images/display/ and review-images/thumbs/, records the result in
 * imageUploads/{uploadId} for the client to pick up, and deletes the raw
 * upload once conversion succeeds.
 */
exports.processReviewImage = onObjectFinalized(
  {
    region: "us-central1",
    // Explicit bucket required: FIREBASE_CONFIG isn't reliably present
    // during `firebase deploy`'s local source analysis step, and without
    // this the builder throws "Missing bucket name" and the export is
    // silently dropped from the deployable function list.
    bucket: "review-monster-80750.firebasestorage.app",
  },
  async (event) => {
    const object = event.data;
    const filePath = object.name || "";
    const uploadsPrefix = "review-images/uploads/";

    // Only handle raw uploads; ignore our own derivative writes.
    if (!filePath.startsWith(uploadsPrefix)) return;

    const fileName = filePath.slice(uploadsPrefix.length);
    const uploadId = fileName.split(".")[0];
    if (!uploadId) return;

    const firestore = getDb();
    const statusRef = firestore.collection("imageUploads").doc(uploadId);
    const bucket = getStorage().bucket(object.bucket);
    const rawFile = bucket.file(filePath);

    try {
      if (
        !object.contentType || !object.contentType.startsWith("image/") ||
        Number(object.size) > MAX_UPLOAD_BYTES
      ) {
        throw new Error("Rejected: not a valid image upload");
      }

      const [buffer] = await rawFile.download();

      const displayBuffer = await sharp(buffer)
        .rotate()
        .resize({ width: 1600, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      const thumbBuffer = await sharp(buffer)
        .rotate()
        .resize({ width: 400, withoutEnlargement: true })
        .webp({ quality: 70 })
        .toBuffer();

      const displayUrl = await uploadDerivative(
        bucket, `review-images/display/${uploadId}.webp`, displayBuffer,
      );
      const thumbUrl = await uploadDerivative(
        bucket, `review-images/thumbs/${uploadId}.webp`, thumbBuffer,
      );

      await statusRef.set({
        status: "ready",
        displayUrl,
        thumbUrl,
        createdAt: FieldValue.serverTimestamp(),
      });

      await rawFile.delete().catch(() => { });
    } catch (error) {
      console.error("processReviewImage failed", uploadId, error);
      await statusRef.set({
        status: "error",
        message: "We couldn't process that photo. Please try another file.",
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  },
);

/**
 * Uploads a converted image buffer with a download token and returns its
 * public Firebase Storage download URL.
 * @param {object} bucket Admin SDK bucket handle.
 * @param {string} path Destination object path.
 * @param {Buffer} buffer Image bytes to write.
 * @return {Promise<string>} The `?alt=media&token=` download URL.
 */
async function uploadDerivative(bucket, path, buffer) {
  const token = crypto.randomUUID();
  const file = bucket.file(path);
  await file.save(buffer, {
    metadata: {
      contentType: "image/webp",
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });
  return `https://firebasestorage.googleapis.com/v0/b/` +
    `${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

