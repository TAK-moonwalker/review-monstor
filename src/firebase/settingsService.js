import { db } from './config.jsx';
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';

const REF = () => doc(db, 'settings', 'app');

export const getSettings = async () => {
  const snap = await getDoc(REF());
  return snap.exists() ? snap.data() : {};
};

export const updateSettings = (data) =>
  setDoc(REF(), { ...data, updatedAt: serverTimestamp() }, { merge: true });

export const subscribeSettings = (callback, onError) =>
  onSnapshot(REF(), (snap) => callback(snap.exists() ? snap.data() : {}), onError);
