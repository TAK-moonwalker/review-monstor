import { db } from './config.jsx';
import {
  collection,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';

const COL = 'reviews';

const defaults = {
  source: '',
  status: 'pending',
  rating: 5,
  reviewerName: '',
  reviewerEmail: '',
  productHandle: '',
  productTitle: '',
  isBrandTestimonial: false,
  title: '',
  originalTextJa: '',
  cleanedTextJa: '',
  translationEn: '',
  body: '',
  shortQuote: '',
  postcardImageUrl: '',
  pictureUrls: [],
  verified: false,
  reply: '',
  permissionGranted: false,
  exportedToJudgeMe: false,
  reviewDate: null,
};

export const createReview = (data) =>
  addDoc(collection(db, COL), {
    ...defaults,
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

export const getReview = async (id) => {
  const snap = await getDoc(doc(db, COL, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const updateReview = (id, data) =>
  updateDoc(doc(db, COL, id), { ...data, updatedAt: serverTimestamp() });

export const deleteReview = (id) => deleteDoc(doc(db, COL, id));

export const subscribeReviews = (callback, onError) => {
  const q = query(collection(db, COL), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError,
  );
};

export const markReviewsAsExported = (ids) => {
  const batch = writeBatch(db);
  ids.forEach((id) =>
    batch.update(doc(db, COL, id), {
      exportedToJudgeMe: true,
      updatedAt: serverTimestamp(),
    })
  );
  return batch.commit();
};

// Legacy alias
export const addReview = createReview;
