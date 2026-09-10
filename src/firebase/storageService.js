import { storage, db } from './config.jsx';
import { ref, uploadBytes, deleteObject } from 'firebase/storage';
import { doc, onSnapshot } from 'firebase/firestore';

const PROCESSING_TIMEOUT_MS = 30000;

// Resolves once the processReviewImage Cloud Function has converted the raw
// upload to WebP, via the imageUploads/{uploadId} status doc it writes.
const waitForProcessedImage = (uploadId) =>
  new Promise((resolve, reject) => {
    const statusRef = doc(db, 'imageUploads', uploadId);
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error('Photo processing timed out. Please try again.'));
    }, PROCESSING_TIMEOUT_MS);
    const unsubscribe = onSnapshot(
      statusRef,
      (snap) => {
        const data = snap.data();
        if (!data) return;
        if (data.status === 'ready') {
          clearTimeout(timer);
          unsubscribe();
          resolve({ displayUrl: data.displayUrl, thumbUrl: data.thumbUrl });
        } else if (data.status === 'error') {
          clearTimeout(timer);
          unsubscribe();
          reject(new Error(data.message || 'Photo processing failed.'));
        }
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

/**
 * Upload a review photo to Storage and wait for the Cloud Function to
 * convert it to WebP. Returns { downloadURL, thumbUrl, storagePath }, where
 * downloadURL/thumbUrl point at the converted display/thumbnail images.
 */
export const uploadReviewImage = async (file, folder = 'review-images/uploads') => {
  const ext = file.name.split('.').pop();
  const uploadId = crypto.randomUUID();
  const storagePath = `${folder}/${uploadId}.${ext}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file);
  const { displayUrl, thumbUrl } = await waitForProcessedImage(uploadId);
  return { downloadURL: displayUrl, thumbUrl, storagePath };
};

export const deleteReviewImage = (path) => deleteObject(ref(storage, path));

// Legacy aliases
export const uploadImage = (file, path) => uploadReviewImage(file, path);
export const deleteImage = deleteReviewImage;
