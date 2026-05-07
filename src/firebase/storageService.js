import { storage } from './config.jsx';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

/**
 * Upload a file to Firebase Storage.
 * Returns { downloadURL, storagePath }.
 */
export const uploadReviewImage = async (file, folder = 'review-images') => {
  const ext = file.name.split('.').pop();
  const storagePath = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(storageRef);
  return { downloadURL, storagePath };
};

export const deleteReviewImage = (path) => deleteObject(ref(storage, path));

// Legacy aliases
export const uploadImage = (file, path) => uploadReviewImage(file, path);
export const deleteImage = deleteReviewImage;
