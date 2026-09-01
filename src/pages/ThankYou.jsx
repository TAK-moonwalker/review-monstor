import { useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  IconButton,
  Snackbar,
  Tooltip,
  Typography,
} from "@mui/material";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined";
import { useSettings } from "../hooks/useSettings";

const SHOP_URL = "https://shopify.sulci.co.jp/";
const SHOP_URL_EN = "https://sulciglobal.com/";

const detectDefaultLanguage = () => {
  if (typeof navigator === "undefined") return "en";
  const locale = String(
    navigator.language || navigator.userLanguage || "",
  ).toLowerCase();
  return locale.startsWith("ja") ? "ja" : "en";
};

const UI_COPY = {
  en: {
    title: "Thank You!",
    defaultThanks: "Your review has been submitted successfully.",
    couponMessage: "Please use this coupon for your next shopping!",
    copyCode: "Copy code",
    backToShop: "Back to Shop",
    copied: "Coupon code copied!",
  },
  ja: {
    title: "ありがとうございました！",
    defaultThanks: "レビューの送信が完了しました。",
    couponMessage: "次回のお買い物でこちらのクーポンをご利用ください！",
    copyCode: "コードをコピー",
    backToShop: "ショップに戻る",
    copied: "クーポンコードをコピーしました！",
  },
};

export default function ThankYou() {
  const location = useLocation();
  const { settings, loading } = useSettings();
  const [copied, setCopied] = useState(false);

  // Prefer values passed via router state, fall back to live settings
  const state = location.state || {};
  const language = state.language === "ja" ? "ja" : detectDefaultLanguage();
  const t = UI_COPY[language];
  const couponEnabled = state.couponEnabled ?? settings.couponEnabled;
  const couponCode = state.couponCode ?? settings.couponCode;
  const thankYouMessage = state.thankYouMessage ?? settings.thankYouMessage;

  const handleCopy = () => {
    navigator.clipboard.writeText(couponCode);
    setCopied(true);
  };

  return (
    <Container maxWidth="xs">
      <Box sx={{ mt: 8, mb: 6, textAlign: "center" }}>
        <CheckCircleOutlined
          sx={{ fontSize: 72, color: "success.main", mb: 2 }}
        />

        <Typography variant="h4" fontWeight={700} gutterBottom>
          {t.title}
        </Typography>

        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {thankYouMessage || t.defaultThanks}
        </Typography>

        {!loading && couponEnabled && couponCode && (
          <Card variant="outlined" sx={{ mt: 2, mb: 3 }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {t.couponMessage}
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1,
                  mt: 1,
                }}
              >
                <Typography
                  variant="h5"
                  fontWeight={700}
                  color="primary"
                  sx={{ letterSpacing: 3 }}
                >
                  {couponCode}
                </Typography>
                <Tooltip title={t.copyCode}>
                  <IconButton size="small" onClick={handleCopy}>
                    <ContentCopyOutlined fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              <Box sx={{ mt: 2, textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary">
                  Our online shop ↓
                </Typography>
                <Button
                  component="a"
                  href={SHOP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="small"
                  sx={{ mt: 0.5, display: "block" }}
                >
                  {SHOP_URL}
                </Button>
                <Button
                  component="a"
                  href={SHOP_URL_EN}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="small"
                  sx={{ mt: 0.5, textTransform: "none", display: "block" }}
                >
                  English Store → {SHOP_URL_EN}
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}

        {settings.shopUrl && (
          <Button
            variant="contained"
            component="a"
            href={settings.shopUrl}
            sx={{ mt: 1 }}
            fullWidth
          >
            {t.backToShop}
          </Button>
        )}
      </Box>

      <Snackbar
        open={copied}
        autoHideDuration={2500}
        onClose={() => setCopied(false)}
        message={t.copied}
      />
    </Container>
  );
}
