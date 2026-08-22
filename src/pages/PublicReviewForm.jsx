import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Container,
  FormControlLabel,
  IconButton,
  MenuItem,
  Rating,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getReviewRequestByToken } from "../firebase/requestService";
import { getSettings } from "../firebase/settingsService";
import CROCHETER_NAMES from "../data/crocheters.json";
import AddPhotoAlternateOutlined from "@mui/icons-material/AddPhotoAlternateOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import { uploadReviewImage } from "../firebase/storageService";

const MAX_PUBLIC_PHOTOS = 3;
const MAX_PHOTO_BYTES = 1.4 * 1024 * 1024; // 1.4 MB

const detectDefaultLanguage = () => {
  if (typeof navigator === "undefined") return "en";
  const locale = String(
    navigator.language || navigator.userLanguage || "",
  ).toLowerCase();
  return locale.startsWith("ja") ? "ja" : "en";
};

const normalizeTokenParam = (value) => {
  const raw = String(value || "");
  let decoded;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  return decoded.trim().replace(/\s+/g, "");
};

const UI_COPY = {
  en: {
    invalid: "This review link is invalid or has expired.",
    used: "This review has already been submitted. Thank you!",
    writeReview: "Write a Review",
    reviewSharing: "We share the review to each crocheter who made this bag.",
    product: "Product",
    rating: "Rating *",
    language: "Language",
    languageEn: "English",
    languageJa: "Japanese",
    yourName: "Your name",
    yourReview: "Your Review *",
    crocheterLabel: "Please select Crocheter's name *",
    permission: "I give permission to use my review for promotional purposes",
    imagesOptional: "Images are optional.",
    addPhoto: "Add Photo",
    uploading: "Uploading…",
    errorPhotoCount: "Maximum 3 photos allowed.",
    errorPhotoSize: "File must be 1.4 MB or smaller.",
    errorPhotoUpload: "Upload failed. Please try again.",
    submit: "Submit Review",
    submitting: "Submitting…",
    errorRating: "Please select a rating",
    errorName: "Please enter your name (2-60 characters, no URLs)",
    errorBody: "Please write your review (10-2000 characters, no URLs)",
    errorCrocheter: "Please select who made this item",
    submitFailed: "Failed to submit. Please try again.",
  },
  ja: {
    invalid: "このレビューリンクは無効か有効期限切れです。",
    used: "このレビューはすでに送信されています。ありがとうございます！",
    writeReview: "レビューを投稿する",
    reviewSharing:
      "このバッグを作った編み子さん一人ひとりにレビューを共有します。",
    product: "商品",
    rating: "評価 *",
    language: "言語",
    languageEn: "英語",
    languageJa: "日本語",
    yourName: "お名前",
    yourReview: "レビュー内容 *",
    crocheterLabel: "編み子さんのお名前を選んでください *",
    permission: "レビューをプロモーション目的で使用することに同意します",
    imagesOptional: "画像は任意です。",
    addPhoto: "写真を追加",
    uploading: "アップロード中…",
    errorPhotoCount: "写真は最大3枚までです。",
    errorPhotoSize: "ファイルは1.4MB以下にしてください。",
    errorPhotoUpload: "アップロードに失敗しました。もう一度お試しください。",
    submit: "レビューを送信",
    submitting: "送信中…",
    errorRating: "評価を選択してください",
    errorName: "お名前を入力してください（2～60文字、URL不可）",
    errorBody: "レビュー内容を入力してください！10～2000文字、URL不可）",
    errorCrocheter: "この商品を作った方を選択してください",
    submitFailed: "送信に失敗しました。もう一度お試しください。",
  },
};

const URL_RE = /https?:\/\/|www\./i;

const INITIAL = {
  rating: 5,
  reviewerName: "",
  language: detectDefaultLanguage(),
  body: "",
  crocheterName: "",
  permissionGranted: true,
  website: "", // honeypot
  pictureUrls: [],
};

export default function PublicReviewForm() {
  const { token } = useParams();
  const normalizedToken = normalizeTokenParam(token);
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [settings, setSettings] = useState({});
  const [pageStatus, setPageStatus] = useState("loading"); // loading | valid | used | invalid
  const [form, setForm] = useState(INITIAL);
  const [formLoadedAt] = useState(() => Date.now());
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const pictureInputRef = useRef(null);
  const [pictureUploading, setPictureUploading] = useState(false);
  const [pictureError, setPictureError] = useState("");
  const language = form.language === "ja" ? "ja" : "en";
  const t = UI_COPY[language];

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!normalizedToken) {
          setPageStatus("invalid");
          return;
        }
        const req = await getReviewRequestByToken(normalizedToken);
        if (!req) {
          setPageStatus("invalid");
          return;
        }
        if (req.active === false) {
          setPageStatus("invalid");
          return;
        }
        const s = req.uid ? await getSettings(req.uid) : {};
        setSettings(s);
        setRequest(req);
        setForm((prev) => ({
          ...prev,
          reviewerName: req.customerName || "",
          language: detectDefaultLanguage(),
        }));
        setPageStatus("valid");
      } catch {
        setPageStatus("invalid");
      }
    };
    loadData();
  }, [normalizedToken]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const validate = () => {
    const e = {};
    if (!form.rating) e.rating = t.errorRating;
    const name = form.reviewerName.trim();
    if (!name || name.length < 2 || name.length > 60 || URL_RE.test(name))
      e.reviewerName = t.errorName;
    const body = form.body.trim();
    if (!body || body.length < 10 || body.length > 2000 || URL_RE.test(body))
      e.body = t.errorBody;
    if (!form.crocheterName) e.crocheterName = t.errorCrocheter;
    return e;
  };

  const handlePictureUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if ((form.pictureUrls?.length ?? 0) >= MAX_PUBLIC_PHOTOS) {
      setPictureError(t.errorPhotoCount);
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPictureError(t.errorPhotoSize);
      return;
    }
    setPictureUploading(true);
    setPictureError("");
    try {
      const { downloadURL } = await uploadReviewImage(file);
      setForm((prev) => ({
        ...prev,
        pictureUrls: [...(prev.pictureUrls ?? []), downloadURL],
      }));
    } catch {
      setPictureError(t.errorPhotoUpload);
    } finally {
      setPictureUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setSubmitting(true);
    try {
      const functions = getFunctions();
      const submitReviewByToken = httpsCallable(
        functions,
        "submitReviewByToken",
      );
      const { data } = await submitReviewByToken({
        token: normalizedToken,
        reviewerName: form.reviewerName,
        rating: form.rating,
        language: form.language,
        body: form.body,
        crocheterName: form.crocheterName,
        permissionGranted: form.permissionGranted,
        pictureUrls: form.pictureUrls,
        website: form.website,
        formLoadedAt,
      });
      navigate("/thank-you", {
        state: {
          language,
          couponEnabled: data.couponEnabled,
          couponCode: data.couponCode,
          thankYouMessage: data.thankYouMessage,
        },
      });
    } catch (err) {
      const msg = err?.message || t.submitFailed;
      setErrors({ form: msg });
      setSubmitting(false);
    }
  };

  if (pageStatus === "loading") {
    return (
      <Container maxWidth="sm" sx={{ mt: 10, textAlign: "center" }}>
        <CircularProgress />
      </Container>
    );
  }

  if (pageStatus === "used") {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Alert severity="info">{t.invalid}</Alert>
      </Container>
    );
  }

  if (pageStatus === "invalid") {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Alert severity="error">{t.invalid}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 4, mb: 6 }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          {settings.reviewFormTitle || t.writeReview}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 1 }}>
          {t.reviewSharing}
        </Typography>
        {settings.reviewFormDescription && (
          <Typography color="text.secondary" sx={{ mb: 1 }}>
            {settings.reviewFormDescription}
          </Typography>
        )}
        {request.productTitle && (
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {t.product}: {request.productTitle}
          </Typography>
        )}

        {errors.form && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errors.form}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="body2" fontWeight={500} gutterBottom>
                {t.rating}
              </Typography>
              <Rating
                size="large"
                value={form.rating}
                onChange={(_, val) => set("rating", val)}
              />
              {errors.rating && (
                <Typography color="error" variant="caption" display="block">
                  {errors.rating}
                </Typography>
              )}
            </Box>

            <TextField
              select
              label={t.language}
              value={form.language}
              onChange={(e) => set("language", e.target.value)}
              fullWidth
            >
              <MenuItem value="en">{t.languageEn}</MenuItem>
              <MenuItem value="ja">{t.languageJa}</MenuItem>
            </TextField>

            <TextField
              label={t.yourName}
              value={form.reviewerName}
              onChange={(e) => set("reviewerName", e.target.value)}
              fullWidth
              error={!!errors.reviewerName}
              helperText={errors.reviewerName}
            />
            <TextField
              label={t.yourReview}
              value={form.body}
              onChange={(e) => set("body", e.target.value)}
              multiline
              rows={5}
              fullWidth
              error={!!errors.body}
              helperText={errors.body}
            />

            <Autocomplete
              options={CROCHETER_NAMES}
              value={form.crocheterName || null}
              onChange={(_, val) => set("crocheterName", val ?? "")}
              disableClearable={false}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t.crocheterLabel}
                  error={!!errors.crocheterName}
                  helperText={errors.crocheterName}
                />
              )}
            />

            {/* honeypot: visually hidden, traps bots that fill all fields */}
            <TextField
              name="website"
              value={form.website}
              onChange={(e) => set("website", e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              sx={{ position: "absolute", left: "-9999px", opacity: 0 }}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={form.permissionGranted}
                  onChange={(e) => set("permissionGranted", e.target.checked)}
                />
              }
              label={t.permission}
            />

            {/* Image upload — files go to Storage before submit */}
            <Box>
              <input
                ref={pictureInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handlePictureUpload}
              />
              <Stack direction="row" alignItems="center" spacing={1}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={
                    pictureUploading ? (
                      <CircularProgress size={16} />
                    ) : (
                      <AddPhotoAlternateOutlined />
                    )
                  }
                  onClick={() => pictureInputRef.current?.click()}
                  disabled={
                    pictureUploading ||
                    (form.pictureUrls?.length ?? 0) >= MAX_PUBLIC_PHOTOS
                  }
                >
                  {pictureUploading ? t.uploading : t.addPhoto}
                </Button>
                <Typography variant="caption" color="text.secondary">
                  {t.imagesOptional}
                </Typography>
              </Stack>
              {pictureError && (
                <Typography
                  variant="caption"
                  color="error"
                  display="block"
                  sx={{ mt: 0.5 }}
                >
                  {pictureError}
                </Typography>
              )}
              {Array.isArray(form.pictureUrls) &&
                form.pictureUrls.length > 0 && (
                  <Box
                    sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1 }}
                  >
                    {form.pictureUrls.map((url, i) => (
                      <Box
                        key={i}
                        sx={{ position: "relative", width: 80, height: 80 }}
                      >
                        <Box
                          component="img"
                          src={url}
                          alt={`Review photo ${i + 1}`}
                          sx={{
                            width: 80,
                            height: 80,
                            objectFit: "cover",
                            borderRadius: 1,
                            border: "1px solid",
                            borderColor: "divider",
                          }}
                        />
                        <IconButton
                          size="small"
                          sx={{
                            position: "absolute",
                            top: -8,
                            right: -8,
                            bgcolor: "background.paper",
                            border: "1px solid",
                            borderColor: "divider",
                            p: 0.25,
                          }}
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              pictureUrls: prev.pictureUrls.filter(
                                (_, idx) => idx !== i,
                              ),
                            }))
                          }
                        >
                          <CloseOutlined sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                )}
            </Box>

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={submitting}
            >
              {submitting ? t.submitting : t.submit}
            </Button>
          </Stack>
        </Box>
      </Box>
    </Container>
  );
}
