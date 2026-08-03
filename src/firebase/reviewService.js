import { db } from './config.jsx';
import {
  collection,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
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
  titleJa: '',
  titleEn: '',
  originalTextJa: '',
  bodyJa: '',
  bodyEn: '',
  body: '',
  shortQuoteJa: '',
  shortQuoteEn: '',
  postcardImageUrl: '',
  pictureUrls: [],
  verified: false,
  reply: '',
  permissionGranted: false,
  exportedToJudgeMeEn: null,
  exportedToJudgeMeJa: null,
  reviewDate: null,
};

export const createReview = (uid, data) =>
  addDoc(collection(db, COL), {
    uid,
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

export const subscribeReviews = (uid, callback, onError) => {
  const q = query(collection(db, COL), where('uid', '==', uid), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap) => {
      if (snap.metadata.hasPendingWrites) {
        return;
      }
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    onError,
  );
};

export const markReviewsAsExported = (ids, language) => {
  const field = language === 'ja' ? 'exportedToJudgeMeJa' : 'exportedToJudgeMeEn';
  const batch = writeBatch(db);
  ids.forEach((id) =>
    batch.update(doc(db, COL, id), {
      [field]: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
  return batch.commit();
};

// Legacy alias (uid, data)
export const addReview = createReview;
