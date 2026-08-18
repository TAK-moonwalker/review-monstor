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
  limit,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';


const COL = 'reviewRequests';

export const createReviewRequest = (uid, data) =>
  addDoc(collection(db, COL), {
    uid,
    token: data.token ?? '',
    language: data.language ?? 'en',
    customerName: data.customerName ?? '',
    customerEmail: data.customerEmail ?? '',
    orderNumber: data.orderNumber ?? '',
    productHandle: data.productHandle ?? '',
    productTitle: data.productTitle ?? '',
    crocheterName: data.crocheterName ?? '',
    couponCode: data.couponCode ?? '',
    used: false,
    active: data.active ?? true,
    submittedReviewId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

export const getReviewRequestsByHandle = async (uid, productHandle) => {
  const q = query(
    collection(db, COL),
    where('uid', '==', uid),
    where('productHandle', '==', productHandle),
    limit(2),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getReviewRequestByHandleAndLanguage = async (uid, productHandle, language) => {
  const all = await getReviewRequestsByHandle(uid, productHandle);
  return all.find((r) => r.language === language) ?? null;
};

export const setReviewRequestActive = (id, active) =>
  updateDoc(doc(db, COL, id), { active, updatedAt: serverTimestamp() });

export const getReviewRequestByToken = async (token) => {
  const q = query(collection(db, COL), where('token', '==', token), limit(1));
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

export const subscribeReviewRequests = (uid, callback, onError) => {
  const q = query(collection(db, COL), where('uid', '==', uid), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError,
  );
};

export const deleteReviewRequest = (id) => deleteDoc(doc(db, COL, id));

export const updateReviewRequest = (id, data) =>
  updateDoc(doc(db, COL, id), { ...data, updatedAt: serverTimestamp() });

// Legacy aliases
export const createRequest = createReviewRequest;
export const getRequestByToken = getReviewRequestByToken;
export const markTokenUsed = (id) => markRequestUsed(id, null);
export const subscribeRequests = subscribeReviewRequests;
