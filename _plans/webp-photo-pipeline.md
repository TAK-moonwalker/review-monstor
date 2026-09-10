# Plan: WebP Photo Pipeline for Review Uploads

## TL;DR

Raise the public photo upload cap to 4.8 MB, add a Storage-triggered Cloud
Function (`sharp`) that converts every uploaded photo into a compressed
"display" WebP (1600px, q80) and a "thumb" WebP (400px, q70), deletes the
original raw upload, and bridges the async result back to the client via a
new `imageUploads/{uploadId}` Firestore doc that the client listens to before
enabling submit. Applies to both the public form and the admin manual entry
form (shared `uploadReviewImage()`).

Decisions locked in:

- Client WAITS for the WebP ("Processing photo…") before allowing submit.
- Applies to both PublicReviewForm.jsx and ReviewFormFields.jsx (shared service).
- Original raw upload is deleted after successful conversion; kept only if
  conversion fails (for retry/debugging).
- Display 1600px / Thumb 400px, quality 80/70.

## Steps

### Phase 1 — Storage & Firestore rules (foundation, no code deps)

1. `storage.rules`: split the single `review-images/{allPaths=**}` block into:
   - `review-images/uploads/**` — public `create`/auth `update` with
     `request.resource.size <= 5033165` (4.8 MB) and `image/.*` contentType
     (same shape as today, new size + new subfolder). `read: auth != null`.
   - `review-images/display/**` and `review-images/thumbs/**` — `read: true`
     (public review/SNS display), `write: false` (Cloud Functions Admin SDK
     only, bypasses rules).
2. `firestore.rules`: add a new `imageUploads/{uploadId}` match:
   `allow get: if true; allow list, create, update, delete: if false;`
   (mirrors the existing `reviewRequests` get-by-id / admin-only-write pattern).

### Phase 2 — Cloud Function (depends on Phase 1 paths)

3. `functions/package.json`: add `"sharp"` dependency.
4. `functions/index.js`: add `processReviewImage`, an
   `onObjectFinalized` (firebase-functions/v2/storage) trigger scoped to the
   bucket, guarded to only act on paths under `review-images/uploads/`
   (prevents recursion since outputs live in `display/`/`thumbs/`):
   - Parse `uploadId` from the filename (basename minus extension).
   - Download object bytes into memory, run through `sharp`:
     - `.rotate()` (EXIF auto-orient) → `.resize({width:1600, withoutEnlargement:true}).webp({quality:80})` → display buffer.
     - `.resize({width:400, withoutEnlargement:true}).webp({quality:70})` → thumb buffer.
   - Upload both buffers to `review-images/display/{uploadId}.webp` and
     `review-images/thumbs/{uploadId}.webp` with `contentType: image/webp` and
     a `metadata.firebaseStorageDownloadTokens` (crypto.randomUUID()) so a
     `?alt=media&token=` download URL can be built manually (Admin SDK has no
     `getDownloadURL` helper).
   - Write `imageUploads/{uploadId}` = `{ status: 'ready', displayUrl, thumbUrl, createdAt }`.
   - Delete the original raw upload object on success.
   - On any error: write `{ status: 'error', message }` to the same doc and
     leave the raw upload in place (defense: also re-check size ≤ 4.8 MB
     inside the function in case rules are ever bypassed).

### Phase 3 — Client upload service (depends on Phase 2 doc shape)

5. `src/firebase/storageService.js` — rework `uploadReviewImage(file)`:
   - Generate `uploadId` (`crypto.randomUUID()`), upload raw file to
     `review-images/uploads/{uploadId}.{ext}` (unchanged `uploadBytes` call,
     new path).
   - Add `waitForProcessedImage(uploadId)`: `onSnapshot` on
     `doc(db, 'imageUploads', uploadId)` resolving `{ displayUrl, thumbUrl }`
     on `status === 'ready'`, rejecting on `status === 'error'` (surface
     `message`) or a 30s client-side timeout. Always unsubscribe.
   - Return `{ downloadURL: displayUrl, thumbUrl, storagePath }` — keeps the
     existing call signature (`downloadURL`) so callers need only add thumb
     handling, not rewrite it.

### Phase 4 — UI (depends on Phase 3 return shape)

6. Extract shared constants to avoid the current copy-pasted
   `MAX_PHOTO_BYTES` drifting between files — new
   `src/utils/photoUpload.js` exporting `MAX_PHOTO_BYTES = 4.8 * 1024 * 1024`
   and a `formatMb(bytes)` helper.
7. `src/pages/PublicReviewForm.jsx`:
   - Import `MAX_PHOTO_BYTES`/`formatMb` from the new util (remove local const).
   - `handlePictureUpload`: after successful upload, also store the thumb URL
     locally (e.g. `pictureThumbUrls` array, not submitted) so the existing
     80×80 preview box uses the small thumbnail instead of the full display
     image.
   - Add a "processing" UI state distinct from "uploading" (reuse
     `pictureUploading` bool but change label via `t.processingPhoto`), shown
     while waiting on `waitForProcessedImage`.
   - `UI_COPY.errorPhotoSize` becomes a function of the actual file size, e.g.
     `(mb) => \`File is ${mb} MB. Max allowed is 4.8 MB.\``for both`en`/`ja`;
call `formatMb(file.size)` at the point of the size check.
   - Add `errorPhotoTimeout` / generic processing-failure copy for both
     languages, used when `waitForProcessedImage` rejects.
8. `src/components/ReviewFormFields.jsx` — same treatment: shared constant,
   thumb-in-preview, clearer size error, processing state (English-only copy,
   matching this file's existing single-language strings).

### Phase 5 — Verification

9. Firebase emulators (`firebase emulators:start --only functions,firestore,storage,hosting`):
   - Upload a >4.8 MB file on the public form → immediate clear error with
     actual size shown, no Storage write attempted.
   - Upload a valid photo → "Processing…" shows, then preview shows thumb,
     Storage emulator shows raw file removed and `display/`+`thumbs/` webp
     present, `imageUploads/{id}` doc has `status: ready`.
   - Submit the review → `pictureUrls` in the created `reviews` doc are the
     `display/*.webp` URLs (still pass the existing
     `STORAGE_URL_RE`/length checks in `submitReviewByToken`).
   - Force a conversion error (e.g. corrupt file bytes with valid
     content-type) → doc gets `status: error`, form shows the failure message
     and does not hang past the 30s timeout.
10. `npm run lint` in both `my-app/` and `my-app/functions/`.
11. Repeat the same manual checks for the admin `ReviewForm.jsx` /
    `ReviewFormFields.jsx` upload path.

## Relevant files

- `my-app/storage.rules` — split `review-images/**` into `uploads/`, `display/`, `thumbs/`.
- `my-app/firestore.rules` — add `imageUploads/{uploadId}` rule block.
- `my-app/functions/package.json` — add `sharp`.
- `my-app/functions/index.js` — new `processReviewImage` `onObjectFinalized` trigger.
- `my-app/src/firebase/storageService.js` — rework `uploadReviewImage`, add `waitForProcessedImage`.
- `my-app/src/utils/photoUpload.js` (new) — shared `MAX_PHOTO_BYTES`/`formatMb`.
- `my-app/src/pages/PublicReviewForm.jsx` — bump size limit via shared const, thumb preview, clearer errors, processing state.
- `my-app/src/components/ReviewFormFields.jsx` — same treatment as above.

## Decisions

- Bridge async Storage-trigger → client via a dedicated `imageUploads`
  Firestore collection (get-only, server-write-only), following the same
  token/get-by-id trust pattern already used for `reviewRequests`.
- `pictureUrls` submitted to `submitReviewByToken` stay as **display** WebP
  URLs (unchanged shape/validation); thumbnails are a client-local
  convenience for the in-form preview only, not persisted to the review doc
  (no schema change needed in `functions/index.js` validation).
- 4.8 MB → `5033165` bytes exact constant used in `storage.rules` (must stay
  in sync with `MAX_PHOTO_BYTES` in `photoUpload.js`).

## Further Considerations

1. Admin `ReviewFormFields.jsx` currently allows authenticated `update`
   (replace) of storage objects; the new `uploads/` rule preserves that via
   `request.auth != null` on `update`. No further action needed unless you
   want authenticated uploads to skip the wait UX (not requested — left as-is
   for consistency).
