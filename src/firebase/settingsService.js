import { db } from './config.jsx';
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';

const REF = (uid) => doc(db, 'settings', uid);

export const getSettings = async (uid) => {
  const snap = await getDoc(REF(uid));
  return snap.exists() ? snap.data() : {};
};

export const updateSettings = (uid, data) =>
  setDoc(REF(uid), { ...data, updatedAt: serverTimestamp() }, { merge: true });

export const subscribeSettings = (uid, callback, onError) =>
  onSnapshot(REF(uid), (snap) => callback(snap.exists() ? snap.data() : {}), onError);
