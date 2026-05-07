import { db } from './config.jsx';
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';

const COL = 'reviewRequests';

export const createReviewRequest = (data) =>
  addDoc(collection(db, COL), {
    token: data.token ?? '',
    customerName: data.customerName ?? '',
    customerEmail: data.customerEmail ?? '',
    orderNumber: data.orderNumber ?? '',
    productHandle: data.productHandle ?? '',
    productTitle: data.productTitle ?? '',
    used: false,
    expiresAt: data.expiresAt ?? null,
    submittedReviewId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

export const getReviewRequestByToken = async (token) => {
  const q = query(collection(db, COL), where('token', '==', token));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
};

export const markRequestUsed = (id, reviewId) =>
  updateDoc(doc(db, COL, id), {
    used: true,
    submittedReviewId: reviewId ?? null,
    updatedAt: serverTimestamp(),
  });

export const subscribeReviewRequests = (callback, onError) => {
  const q = query(collection(db, COL), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError,
  );
};

export const deleteReviewRequest = (id) => deleteDoc(doc(db, COL, id));

// Legacy aliases
export const createRequest = createReviewRequest;
export const getRequestByToken = getReviewRequestByToken;
export const markTokenUsed = (id) => markRequestUsed(id, null);
export const subscribeRequests = subscribeReviewRequests;
