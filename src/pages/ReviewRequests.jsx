import { useRef, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import QrCode2Outlined from "@mui/icons-material/QrCode2Outlined";
import { QRCodeSVG } from "qrcode.react";
import { toJpeg } from "html-to-image";
import { useReviewRequests } from "../hooks/useReviewRequests";
import {
  createReviewRequest,
  deleteReviewRequest,
  getReviewRequestsByHandle,
  getReviewRequestByHandleAndLanguage,
  setReviewRequestActive,
  updateReviewRequest,
} from "../firebase/requestService";
import { generateToken } from "../utils/generateToken";
import { useAuth } from "../hooks/useAuth";
import ConfirmDialog from "../components/ConfirmDialog";
import LoadingScreen from "../components/LoadingScreen";
import EmptyState from "../components/EmptyState";
import { formatDate } from "../utils/dateUtils";

const BASE_URL = `${window.location.origin}/review`;
const QR_EXPORT_WIDTH_PX = 295; // 25 mm @ 300 dpi
const QR_EXPORT_HEIGHT_PX = 295;

const getInitialForm = () => ({
  language: "en",
  productHandle: "",
  productTitle: "",
  couponCode: "",
});

const QR_COPY = {
  en: {
    title: "QR Code",
    language: "Language",
    languageEn: "English",
    languageJa: "Japanese",
    copyLink: "Copy Link",
    downloadJpeg: "Download JPEG",
    close: "Close",
  },
  ja: {
    title: "QRコード",
    language: "言語",
    languageEn: "英語",
    languageJa: "日本語",
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
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const qrCardRef = useRef(null);

  if (loading) return <LoadingScreen />;

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleCreate = async () => {
    setSaving(true);
    try {
      if (form.productHandle.trim()) {
        const existing = await getReviewRequestByHandleAndLanguage(
          user.uid,
          form.productHandle.trim(),
          form.language,
        );
        if (existing) {
          setForm(getInitialForm());
          setDialogOpen(false);
          setQrTarget(existing);
          return;
        }
      }
      const token = generateToken();
      await createReviewRequest(user.uid, { ...form, token });
      setForm(getInitialForm());
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteTarget) {
      await deleteReviewRequest(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  const handleEditSave = async () => {
    if (!editTarget || !editForm) return;
    setSaving(true);
    try {
      if (editForm.productHandle.trim()) {
        const siblings = await getReviewRequestsByHandle(
          user.uid,
          editForm.productHandle.trim(),
        );
        const conflict = siblings.find(
          (r) => r.id !== editTarget.id && r.language === editForm.language,
        );
        if (conflict) {
          setEditTarget(null);
          setQrTarget(conflict);
          return;
        }
      }
      await updateReviewRequest(editTarget.id, {
        language: editForm.language,
        productHandle: editForm.productHandle,
        productTitle: editForm.productTitle,
        couponCode: editForm.couponCode,
      });
      setEditTarget(null);
    } finally {
      setSaving(false);
    }
  };

  const copyLink = (token) =>
    navigator.clipboard.writeText(`${BASE_URL}/${token}`);

  const formLanguage = form.language === "ja" ? "ja" : "en";
  const fq = QR_COPY[formLanguage];

  const printTitle =
    qrTarget?.productTitle || qrTarget?.productHandle || "Item";
  const qrLanguage = qrTarget?.language === "ja" ? "ja" : "en";
  const q = QR_COPY[qrLanguage];
  const qrLanguageCode = qrLanguage === "ja" ? "JP" : "EN";

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
      link.download = `qr-label-${slug || "item"}-25x25mm.jpg`;
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
                    <Tooltip
                      title={
                        (req.active ?? true)
                          ? "Active — click to deactivate"
                          : "Inactive — click to activate"
                      }
                    >
                      <Switch
                        size="small"
                        checked={req.active ?? true}
                        onChange={() =>
                          setReviewRequestActive(req.id, !(req.active ?? true))
                        }
                        color="success"
                      />
                    </Tooltip>
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
                    <Tooltip title="Edit request">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setEditTarget(req);
                          setEditForm({
                            language: req.language ?? "en",
                            productHandle: req.productHandle ?? "",
                            productTitle: req.productTitle ?? "",
                            couponCode: req.couponCode ?? "",
                          });
                        }}
                      >
                        <EditOutlined fontSize="small" />
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
              label="Product Handle"
              value={form.productHandle}
              onChange={(e) => set("productHandle", e.target.value)}
              fullWidth
              helperText="Shopify product handle (slug). Up to 2 QRs per handle (EN + JA)."
            />
            <TextField
              label="Product Title"
              value={form.productTitle}
              onChange={(e) => set("productTitle", e.target.value)}
              fullWidth
            />
            <TextField
              label="Coupon Code"
              value={form.couponCode}
              onChange={(e) => set("couponCode", e.target.value)}
              fullWidth
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

      {/* Edit Request Dialog */}
      <Dialog
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Edit Review Request</DialogTitle>
        <DialogContent>
          {editForm && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                select
                label="Language"
                value={editForm.language}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, language: e.target.value }))
                }
                fullWidth
              >
                <MenuItem value="en">English</MenuItem>
                <MenuItem value="ja">Japanese</MenuItem>
              </TextField>
              <TextField
                label="Product Handle"
                value={editForm.productHandle}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    productHandle: e.target.value,
                  }))
                }
                fullWidth
                helperText="Shopify product handle (slug)."
              />
              <TextField
                label="Product Title"
                value={editForm.productTitle}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    productTitle: e.target.value,
                  }))
                }
                fullWidth
              />
              <TextField
                label="Coupon Code"
                value={editForm.couponCode}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    couponCode: e.target.value,
                  }))
                }
                fullWidth
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleEditSave}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save"}
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
                  width: "25mm",
                  height: "25mm",
                  boxSizing: "border-box",
                  p: "2.5mm",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1mm",
                  bgcolor: "background.paper",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  "@media print": { border: 0, p: 0 },
                }}
              >
                {/* QR fills all available vertical space */}
                <Box
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    overflow: "hidden",
                  }}
                >
                  <QRCodeSVG
                    value={`${BASE_URL}/${qrTarget.token}`}
                    size={256}
                    style={{ width: "100%", height: "100%", display: "block" }}
                  />
                </Box>
                {/* Footer: product name left, EN/JP badge right */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "1mm",
                    flexShrink: 0,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: "0.52rem",
                      fontWeight: 700,
                      lineHeight: 1.2,
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {printTitle}
                  </Typography>
                  <Box
                    sx={{
                      flexShrink: 0,
                      bgcolor: "text.primary",
                      color: "background.paper",
                      px: "1.2mm",
                      py: "0.4mm",
                      borderRadius: "0.5mm",
                      fontSize: "0.52rem",
                      fontWeight: 800,
                      lineHeight: 1,
                      fontFamily: "monospace",
                    }}
                  >
                    {qrLanguageCode}
                  </Box>
                </Box>
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
