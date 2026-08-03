import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Container,
  FormControlLabel,
  MenuItem,
  Rating,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getReviewRequestByToken } from "../firebase/requestService";
import { getSettings } from "../firebase/settingsService";

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
    product: "Product",
    crocheterMessage:
      "Please write a message to our crocheter {name} who made this bag.",
    rating: "Rating *",
    language: "Language",
    languageEn: "English",
    languageJa: "Japanese",
    yourName: "Your name",
    yourReview: "Your Review *",
    permission: "I give permission to use my review for marketing purposes",
    imagesOptional: "Images are optional and can be attached later if needed.",
    submit: "Submit Review",
    submitting: "Submitting…",
    errorRating: "Please select a rating",
    errorName: "Please enter your name",
    errorBody: "Please write your review",
    submitFailed: "Failed to submit. Please try again.",
  },
  ja: {
    invalid: "このレビューリンクは無効か有効期限切れです。",
    used: "このレビューはすでに送信されています。ありがとうございます。",
    writeReview: "レビューを投稿する",
    product: "商品",
    crocheterMessage:
      "このバッグを作った編み手 {name} へのメッセージをご記入ください。",
    rating: "評価 *",
    language: "言語",
    languageEn: "英語",
    languageJa: "日本語",
    yourName: "お名前",
    yourReview: "レビュー内容 *",
    permission: "レビューをウェブサイトやSNSで使用することに同意します",
    imagesOptional: "画像は任意です。必要に応じて後から追加できます。",
    submit: "レビューを送信",
    submitting: "送信中…",
    errorRating: "評価を選択してください",
    errorName: "お名前を入力してください",
    errorBody: "レビュー内容を入力してください",
    submitFailed: "送信に失敗しました。もう一度お試しください。",
  },
};

const INITIAL = {
  rating: 5,
  reviewerName: "",
  language: detectDefaultLanguage(),
  body: "",
  permissionGranted: true,
};

export default function PublicReviewForm() {
  const { token } = useParams();
  const normalizedToken = normalizeTokenParam(token);
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [settings, setSettings] = useState({});
  const [pageStatus, setPageStatus] = useState("loading"); // loading | valid | used | invalid
  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
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
        if (req.used) {
          setPageStatus("used");
          return;
        }
        if (req.expiresAt) {
          const expires = req.expiresAt?.toDate
            ? req.expiresAt.toDate()
            : new Date(req.expiresAt);
          if (expires < new Date()) {
            setPageStatus("invalid");
            return;
          }
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
    if (!form.reviewerName.trim()) e.reviewerName = t.errorName;
    if (!form.body.trim()) e.body = t.errorBody;
    return e;
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
        permissionGranted: form.permissionGranted,
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
        <Alert severity="info">{t.used}</Alert>
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
        {request.crocheterName && (
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {t.crocheterMessage.replace("{name}", request.crocheterName)}
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

            <FormControlLabel
              control={
                <Checkbox
                  checked={form.permissionGranted}
                  onChange={(e) => set("permissionGranted", e.target.checked)}
                />
              }
              label={t.permission}
            />

            <Typography variant="caption" color="text.secondary">
              {t.imagesOptional}
            </Typography>

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
