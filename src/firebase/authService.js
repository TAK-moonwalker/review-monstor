import { auth, storage } from './config.jsx';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const googleProvider = new GoogleAuthProvider();

// ── Avatar upload helper ──────────────────────────────────────────────────────
// Uploads a File to storage and updates the user's photoURL profile field.
const uploadAvatarAndUpdateProfile = async (user, avatarFile) => {
  const avatarRef = ref(storage, `avatars/${user.uid}`);
  await uploadBytes(avatarRef, avatarFile);
  const photoURL = await getDownloadURL(avatarRef);
  await updateProfile(user, { photoURL });
  return photoURL;
};

// ── Email / Password ──────────────────────────────────────────────────────────

/**
 * Sign up a new admin with email + password.
 * Optionally pass an avatar File to upload and attach to the profile.
 */
export const signupAdmin = async (email, password, { displayName, avatarFile } = {}) => {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const profileUpdate = {};
  if (displayName) profileUpdate.displayName = displayName;
  if (avatarFile) {
    profileUpdate.photoURL = await uploadAvatarAndUpdateProfile(
      credential.user,
      avatarFile
    );
  } else if (Object.keys(profileUpdate).length) {
    await updateProfile(credential.user, profileUpdate);
  }
  return credential;
};

/**
 * Sign in an existing admin with email + password.
 */
export const loginAdmin = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

// ── Google OAuth ──────────────────────────────────────────────────────────────

/**
 * Sign up / sign in with Google popup.
 * If the Google account is new, optionally upload a custom avatarFile
 * (otherwise the Google profile photo is used automatically).
 */
export const signupWithGoogle = async ({ avatarFile } = {}) => {
  const credential = await signInWithPopup(auth, googleProvider);
  if (avatarFile) {
    await uploadAvatarAndUpdateProfile(credential.user, avatarFile);
  }
  return credential;
};

/**
 * Sign in with Google popup (alias — Google handles new vs returning users).
 */
export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);

// ── Session ───────────────────────────────────────────────────────────────────

export const logoutAdmin = () => signOut(auth);

export const getCurrentUser = () => auth.currentUser;

/**
 * Subscribe to auth state changes.
 * @param {(user: import('firebase/auth').User | null) => void} callback
 * @returns unsubscribe function
 */
export const subscribeAuthState = (callback) => onAuthStateChanged(auth, callback);

// ── Legacy aliases (kept for backward compatibility) ─────────────────────────
export const signUp = signupAdmin;
export const signIn = loginAdmin;
export const logOut = logoutAdmin;
