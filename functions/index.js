const {setGlobalOptions} = require("firebase-functions");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");

const projectId =
  process.env.GCLOUD_PROJECT ||
  process.env.GCP_PROJECT ||
  "review-monster-80750";

initializeApp({projectId});
setGlobalOptions({maxInstances: 10, region: "us-central1"});

let db;

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

  // Read settings for coupon data and default status
  const settingsSnap = await db
      .collection("settings").doc("app").get();
  const settings = settingsSnap.exists ? settingsSnap.data() : {};

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

