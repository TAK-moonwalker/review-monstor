import { useRef, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import QrCode2Outlined from "@mui/icons-material/QrCode2Outlined";
import { QRCodeSVG } from "qrcode.react";
import { toJpeg } from "html-to-image";
import { useReviewRequests } from "../hooks/useReviewRequests";
import {
  createReviewRequest,
  deleteReviewRequest,
} from "../firebase/requestService";
import { generateToken } from "../utils/generateToken";
import { useAuth } from "../hooks/useAuth";
import ConfirmDialog from "../components/ConfirmDialog";
import LoadingScreen from "../components/LoadingScreen";
import EmptyState from "../components/EmptyState";
import { formatDate } from "../utils/dateUtils";

const BASE_URL = `${window.location.origin}/review`;
const QR_EXPORT_WIDTH_PX = 567;
const QR_EXPORT_HEIGHT_PX = 709;

const toDateInputValue = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const getDefaultExpiresAt = () => {
  const next = new Date();
  next.setMonth(next.getMonth() + 3);
  return toDateInputValue(next);
};

const getInitialForm = () => ({
  language: "en",
  orderNumber: "",
  productHandle: "",
  productTitle: "",
  crocheterName: "",
  couponCode: "",
  expiresAt: getDefaultExpiresAt(),
});

const QR_COPY = {
  en: {
    title: "QR Code",
    language: "Language",
    languageEn: "English",
    languageJa: "Japanese",
    itemName: "Item name",
    crocheterName: "Crocheter's name",
    askMessage:
      "Please write a message to our crocheter {name} who made this bag.",
    couponMessage: "We give coupon if you write review for us.",
    copyLink: "Copy Link",
    downloadJpeg: "Download JPEG",
    close: "Close",
  },
  ja: {
    title: "QRコード",
    language: "言語",
    languageEn: "英語",
    languageJa: "日本語",
    itemName: "商品名",
    crocheterName: "編み手の名前",
    askMessage: "このバッグを作った {name} へのメッセージをご記入ください。",
    couponMessage: "レビュー投稿でクーポンをプレゼント！",
    copyLink: "リンクをコピー",
    downloadJpeg: "JPEGを保存",
    close: "閉じる",
  },
};

export default function ReviewRequests() {
  const { user } = useAuth();
  const { requests, loading } = useReviewRequests();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(() => getInitialForm());
  const [saving, setSaving] = useState(false);
  const [qrTarget, setQrTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const qrCardRef = useRef(null);

  if (loading) return <LoadingScreen />;

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleCreate = async () => {
    setSaving(true);
    const token = generateToken();
    const expiresAt = form.expiresAt ? new Date(form.expiresAt) : null;
    await createReviewRequest(user.uid, { ...form, token, expiresAt });
    setForm(getInitialForm());
    setSaving(false);
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (deleteTarget) {
      await deleteReviewRequest(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  const copyLink = (token) =>
    navigator.clipboard.writeText(`${BASE_URL}/${token}`);

  const formLanguage = form.language === "ja" ? "ja" : "en";
  const fq = QR_COPY[formLanguage];

  const printTitle =
    qrTarget?.productTitle || qrTarget?.productHandle || "Item";
  const printCrocheterName = qrTarget?.crocheterName || "[]";
  const qrLanguage = qrTarget?.language === "ja" ? "ja" : "en";
  const q = QR_COPY[qrLanguage];

  const handleDownloadJpeg = async () => {
    if (!qrCardRef.current || !qrTarget) return;
    setDownloading(true);
    try {
      const dataUrl = await toJpeg(qrCardRef.current, {
        quality: 0.96,
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        canvasWidth: QR_EXPORT_WIDTH_PX,
        canvasHeight: QR_EXPORT_HEIGHT_PX,
      });

      const slug = printTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `qr-label-${slug || "item"}-48x60mm.jpg`;
      link.click();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Box>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 3 }}
      >
        <Typography variant="h5" fontWeight={700}>
          Review Requests
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          New Request
        </Button>
      </Stack>

      {requests.length === 0 ? (
        <EmptyState message="No review requests yet" />
      ) : (
        <Grid container spacing={2}>
          {requests.map((req) => (
            <Grid size={{ xs: 12, md: 6 }} key={req.id}>
              <Card variant="outlined">
                <CardContent>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="flex-start"
                  >
                    <Box>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {req.productTitle ||
                          req.productHandle ||
                          "Review Request"}
                      </Typography>
                      {req.productTitle && req.productHandle && (
                        <Typography variant="caption" color="text.secondary">
                          {req.productHandle}
                        </Typography>
                      )}
                    </Box>
                    <Chip
                      label={req.used ? "Used" : "Pending"}
                      color={req.used ? "default" : "success"}
                      size="small"
                    />
                  </Stack>

                  {(req.productTitle || req.productHandle) && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1 }}
                    >
                      {req.productTitle}
                      {req.productHandle ? ` (${req.productHandle})` : ""}
                    </Typography>
                  )}
                  {req.crocheterName && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block" }}
                    >
                      Crocheter: {req.crocheterName}
                    </Typography>
                  )}
                  {req.orderNumber && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block" }}
                    >
                      Order: {req.orderNumber}
                    </Typography>
                  )}
                  {req.couponCode && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block" }}
                    >
                      Coupon: {req.couponCode}
                    </Typography>
                  )}
                  {req.language && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block" }}
                    >
                      Language: {req.language === "ja" ? "Japanese" : "English"}
                    </Typography>
                  )}

                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 0.5 }}
                  >
                    Created: {formatDate(req.createdAt)}
                    {req.expiresAt &&
                      ` · Expires: ${formatDate(req.expiresAt)}`}
                  </Typography>

                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Tooltip title="Copy review link">
                      <IconButton
                        size="small"
                        onClick={() => copyLink(req.token)}
                      >
                        <ContentCopyOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Show QR code">
                      <IconButton size="small" onClick={() => setQrTarget(req)}>
                        <QrCode2Outlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete request">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => setDeleteTarget(req)}
                      >
                        <DeleteOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create Request Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>New Review Request</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label={fq.language}
              value={form.language}
              onChange={(e) => set("language", e.target.value)}
              fullWidth
            >
              <MenuItem value="en">{fq.languageEn}</MenuItem>
              <MenuItem value="ja">{fq.languageJa}</MenuItem>
            </TextField>
            <TextField
              label="Order Number"
              value={form.orderNumber}
              onChange={(e) => set("orderNumber", e.target.value)}
              fullWidth
            />
            <TextField
              label="Product Handle"
              value={form.productHandle}
              onChange={(e) => set("productHandle", e.target.value)}
              fullWidth
            />
            <TextField
              label="Product Title"
              value={form.productTitle}
              onChange={(e) => set("productTitle", e.target.value)}
              fullWidth
            />
            <TextField
              label="Crocheter's Name"
              value={form.crocheterName}
              onChange={(e) => set("crocheterName", e.target.value)}
              fullWidth
            />
            <TextField
              label="Coupon Code"
              value={form.couponCode}
              onChange={(e) => set("couponCode", e.target.value)}
              fullWidth
            />
            <TextField
              label="Expires At"
              type="date"
              value={form.expiresAt}
              onChange={(e) => set("expiresAt", e.target.value)}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving}>
            {saving ? "Creating…" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={!!qrTarget} onClose={() => setQrTarget(null)}>
        <DialogTitle>{q.title}</DialogTitle>
        <DialogContent>
          <Stack alignItems="center" spacing={2} sx={{ p: 2 }}>
            {qrTarget && (
              <Box
                ref={qrCardRef}
                sx={{
                  width: 240,
                  aspectRatio: "4 / 5",
                  p: 1.5,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  bgcolor: "background.paper",
                  "@media print": {
                    border: 0,
                    p: 0,
                  },
                }}
              >
                <Stack spacing={1} sx={{ height: "100%" }}>
                  <Typography
                    variant="caption"
                    sx={{
                      lineHeight: 1.2,
                      textAlign: "center",
                      fontWeight: 600,
                      fontSize: "0.64rem",
                    }}
                  >
                    {q.askMessage.replace("{name}", printCrocheterName)}
                  </Typography>
                  <Box
                    sx={{
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 1,
                      py: 0.75,
                      display: "flex",
                      justifyContent: "center",
                    }}
                  >
                    <QRCodeSVG
                      value={`${BASE_URL}/${qrTarget.token}`}
                      size={108}
                    />
                  </Box>
                  <Box sx={{ width: "100%" }}>
                    <Typography
                      variant="overline"
                      color="text.secondary"
                      sx={{
                        fontWeight: 800,
                        letterSpacing: 0.8,
                        fontSize: "0.58rem",
                      }}
                    >
                      {q.itemName}
                    </Typography>
                    <Typography
                      variant="body2"
                      fontWeight={700}
                      sx={{ lineHeight: 1.15, fontSize: "0.72rem" }}
                    >
                      {printTitle}
                    </Typography>
                  </Box>
                  <Box sx={{ width: "100%" }}>
                    <Typography
                      variant="overline"
                      color="text.secondary"
                      sx={{
                        fontWeight: 800,
                        letterSpacing: 0.8,
                        fontSize: "0.58rem",
                      }}
                    >
                      {q.crocheterName}
                    </Typography>
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      sx={{ lineHeight: 1.15, fontSize: "0.72rem" }}
                    >
                      {printCrocheterName}
                    </Typography>
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{
                      mt: 0.5,
                      lineHeight: 1.2,
                      fontSize: "0.64rem",
                      fontWeight: 700,
                      fontStyle: "italic",
                    }}
                  >
                    {q.couponMessage}
                  </Typography>
                </Stack>
              </Box>
            )}
            {qrTarget && (
              <Stack direction="row" spacing={1}>
                <Button
                  startIcon={<ContentCopyOutlined />}
                  onClick={() => copyLink(qrTarget.token)}
                >
                  {q.copyLink}
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleDownloadJpeg}
                  disabled={downloading}
                >
                  {downloading ? "..." : q.downloadJpeg}
                </Button>
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ "@media print": { display: "none" } }}>
          <Button onClick={() => setQrTarget(null)}>{q.close}</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Request"
        message={`Delete review request for ${deleteTarget?.customerName || "this customer"}? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
