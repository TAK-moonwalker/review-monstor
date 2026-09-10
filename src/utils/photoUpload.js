// Must stay in sync with MAX_UPLOAD_BYTES in functions/index.js and the
// size check in storage.rules.
export const MAX_PHOTO_BYTES = 4.8 * 1024 * 1024; // 4.8 MB

export const formatMb = (bytes) => (bytes / (1024 * 1024)).toFixed(1);
