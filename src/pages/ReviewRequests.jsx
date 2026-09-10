import { useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
import PeopleAltOutlined from "@mui/icons-material/PeopleAltOutlined";
import QrCode2Outlined from "@mui/icons-material/QrCode2Outlined";
import UploadFileOutlined from "@mui/icons-material/UploadFileOutlined";
import { QRCodeSVG } from "qrcode.react";
import { toJpeg } from "html-to-image";
import { useReviewRequests } from "../hooks/useReviewRequests";
import { useSettings } from "../hooks/useSettings";
import { updateSettings } from "../firebase/settingsService";
import {
  createReviewRequest,
  deleteReviewRequest,
  setReviewRequestActive,
  updateReviewRequest,
} from "../firebase/requestService";
import { generateToken } from "../utils/generateToken";
import { useAuth } from "../hooks/useAuth";
import ConfirmDialog from "../components/ConfirmDialog";
import LoadingScreen from "../components/LoadingScreen";
import EmptyState from "../components/EmptyState";
import { formatDate } from "../utils/dateUtils";
import CROCHETER_NAMES from "../data/crocheters.json";
import DEFAULT_ITEMS from "../data/items.json";

const BASE_URL = `${window.location.origin}/review`;
const QR_EXPORT_WIDTH_PX = 295; // 25 mm @ 300 dpi
const QR_EXPORT_HEIGHT_PX = 295;

const getInitialForm = () => ({
  title: "",
  language: "en",
  couponCode: "",
  shopUrl: "",
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

function parseCrochetersCsv(csvText) {
  const lines = csvText.split(/\r?\n/);
  const names = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const cells = trimmed.split(/,/);
    for (const cell of cells) {
      const val = cell
        .trim()
        .replace(/^["']|["']$/g, "")
        .trim();
      if (!val) continue;
      const lower = val.toLowerCase();
      if (
        lower === "name" ||
        lower === "names" ||
        lower === "crocheter" ||
        lower === "crocheters" ||
        lower === "crocheter_name" ||
        val === "名前" ||
        val === "編み子" ||
        val === "編み子名"
      ) {
        continue;
      }
      if (!names.includes(val)) {
        names.push(val);
      }
    }
  }
  return names;
}

function parseItemsJson(jsonText) {
  const data = JSON.parse(jsonText);
  const rawList = Array.isArray(data)
    ? data
    : Array.isArray(data?.products)
      ? data.products
      : Array.isArray(data?.items)
        ? data.items
        : [];

  const items = [];
  for (const item of rawList) {
    if (!item) continue;
    const title = String(
      item.title || item.name || item.productTitle || "",
    ).trim();
    if (!title) continue;
    const handle =
      String(item.handle || item.sku || item.productHandle || "").trim() ||
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    items.push({ title, handle });
  }
  return items;
}

export default function ReviewRequests() {
  const { user } = useAuth();
  const { requests, loading: requestsLoading } = useReviewRequests();
  const { settings, loading: settingsLoading } = useSettings();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(() => getInitialForm());
  const [saving, setSaving] = useState(false);
  const [qrTarget, setQrTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState(null);

  // Crocheters modal state
  const [crocheterDialogOpen, setCrocheterDialogOpen] = useState(false);
  const [crocheterDraft, setCrocheterDraft] = useState([]);
  const [crocheterSaving, setCrocheterSaving] = useState(false);
  const [crocheterError, setCrocheterError] = useState("");
  const crocheterFileInputRef = useRef(null);

  // Items modal state
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [itemDraft, setItemDraft] = useState([]);
  const [itemSaving, setItemSaving] = useState(false);
  const [itemError, setItemError] = useState("");
  const itemFileInputRef = useRef(null);

  const [toastMessage, setToastMessage] = useState("");
  const qrCardRef = useRef(null);

  const activeCrocheters =
    Array.isArray(settings?.crocheterList) && settings.crocheterList.length > 0
      ? settings.crocheterList
      : CROCHETER_NAMES;

  const activeItems =
    Array.isArray(settings?.itemList) && settings.itemList.length > 0
      ? settings.itemList
      : DEFAULT_ITEMS;

  const handleOpenCrocheterDialog = () => {
    setCrocheterDraft(activeCrocheters);
    setCrocheterError("");
    setCrocheterDialogOpen(true);
  };

  const handleOpenItemDialog = () => {
    setItemDraft(activeItems);
    setItemError("");
    setItemDialogOpen(true);
  };

  if (requestsLoading || settingsLoading) return <LoadingScreen />;

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleCreate = async () => {
    setSaving(true);
    try {
      const token = generateToken();
      await createReviewRequest(user.uid, { ...form, token });
      setForm(getInitialForm());
      setDialogOpen(false);
      setToastMessage("Review request created successfully");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteTarget) {
      await deleteReviewRequest(deleteTarget.id);
      setDeleteTarget(null);
      setToastMessage("Review request deleted");
    }
  };

  const handleEditSave = async () => {
    if (!editTarget || !editForm) return;
    setSaving(true);
    try {
      await updateReviewRequest(editTarget.id, {
        title: editForm.title,
        language: editForm.language,
        couponCode: editForm.couponCode,
        shopUrl: editForm.shopUrl,
      });
      setEditTarget(null);
      setToastMessage("Review request updated");
    } finally {
      setSaving(false);
    }
  };

  const copyLink = (token) => {
    navigator.clipboard.writeText(`${BASE_URL}/${token}`);
    setToastMessage("Link copied to clipboard");
  };

  const formLanguage = form.language === "ja" ? "ja" : "en";
  const fq = QR_COPY[formLanguage];

  const printTitle = qrTarget?.title || qrTarget?.productTitle || "Review";
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
        .replace(/^https?:\/\//, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `qr-label-${slug || "review"}-${qrLanguageCode}-25x25mm.jpg`;
      link.click();
    } finally {
      setDownloading(false);
    }
  };

  // Crocheter CSV upload handler
  const handleCrocheterFileUpload = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCrocheterError("");
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = String(event.target?.result || "");
        const parsed = parseCrochetersCsv(text);
        if (parsed.length === 0) {
          setCrocheterError("No valid names found in the CSV file.");
          return;
        }
        setCrocheterDraft(parsed);
      } catch {
        setCrocheterError("Failed to parse CSV file. Please check format.");
      }
    };
    reader.onerror = () => {
      setCrocheterError("Failed to read file.");
    };
    reader.readAsText(file);
  };

  const handleSaveCrocheters = async () => {
    if (!user) return;
    if (crocheterDraft.length === 0) {
      setCrocheterError("Crocheter list cannot be empty.");
      return;
    }
    setCrocheterSaving(true);
    setCrocheterError("");
    try {
      await updateSettings(user.uid, { crocheterList: crocheterDraft });
      setCrocheterDialogOpen(false);
      setToastMessage(`Saved ${crocheterDraft.length} crocheters successfully`);
    } catch {
      setCrocheterError("Failed to save crocheters to settings.");
    } finally {
      setCrocheterSaving(false);
    }
  };

  // Item JSON upload handler
  const handleItemFileUpload = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setItemError("");
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = String(event.target?.result || "");
        const parsed = parseItemsJson(text);
        if (parsed.length === 0) {
          setItemError("No valid items found in the JSON file.");
          return;
        }
        setItemDraft(parsed);
      } catch {
        setItemError(
          "Invalid JSON syntax. Please provide a valid JSON array of items.",
        );
      }
    };
    reader.onerror = () => {
      setItemError("Failed to read file.");
    };
    reader.readAsText(file);
  };

  const handleSaveItems = async () => {
    if (!user) return;
    if (itemDraft.length === 0) {
      setItemError("Item list cannot be empty.");
      return;
    }
    setItemSaving(true);
    setItemError("");
    try {
      await updateSettings(user.uid, { itemList: itemDraft });
      setItemDialogOpen(false);
      setToastMessage(`Saved ${itemDraft.length} items successfully`);
    } catch {
      setItemError("Failed to save items to settings.");
    } finally {
      setItemSaving(false);
    }
  };

  const handleDownloadCrocheterDummyCsv = () => {
    const csvContent = "Name\n" + CROCHETER_NAMES.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "dummy-crocheters.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadItemDummyJson = () => {
    const jsonContent = JSON.stringify(DEFAULT_ITEMS, null, 2);
    const blob = new Blob([jsonContent], {
      type: "application/json;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "dummy-items.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Typography variant="h5" fontWeight={700}>
          Review Requests
        </Typography>
        <Stack direction="row" spacing={1.5} flexWrap="wrap">
          <Button
            variant="outlined"
            startIcon={<PeopleAltOutlined />}
            onClick={handleOpenCrocheterDialog}
          >
            Crocheter List (CSV)
          </Button>
          <Button
            variant="outlined"
            startIcon={<Inventory2Outlined />}
            onClick={handleOpenItemDialog}
          >
            Item List (JSON)
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
          >
            New Request
          </Button>
        </Stack>
      </Stack>

      {requests.length === 0 ? (
        <EmptyState message="No review requests yet. Click 'New Request' to generate a review QR code." />
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
                        {req.title ||
                          req.shopUrl ||
                          req.productTitle ||
                          `Review Request (${req.language === "ja" ? "Japanese" : "English"})`}
                      </Typography>
                      {req.shopUrl && (
                        <Typography variant="caption" color="text.secondary">
                          {req.shopUrl}
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

                  {req.couponCode && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block", mt: 1 }}
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
                            title: req.title ?? "",
                            language: req.language ?? "en",
                            couponCode: req.couponCode ?? "",
                            shopUrl: req.shopUrl ?? "",
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
              label="Title"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              fullWidth
              placeholder="e.g. Instagram DM - Sept batch"
              helperText="Unique label to tell this request apart from others"
            />
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
              label="Coupon Code"
              value={form.couponCode}
              onChange={(e) => set("couponCode", e.target.value)}
              fullWidth
              placeholder="e.g. THANKYOU10"
            />
            <TextField
              label="Shop URL"
              value={form.shopUrl}
              onChange={(e) => set("shopUrl", e.target.value)}
              fullWidth
              placeholder="https://sulci.co.jp"
              helperText="Optional shop URL for reference"
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
                label="Title"
                value={editForm.title}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, title: e.target.value }))
                }
                fullWidth
              />
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
              <TextField
                label="Shop URL"
                value={editForm.shopUrl}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    shopUrl: e.target.value,
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

      {/* Manage Crocheters (CSV) Dialog */}
      <Dialog
        open={crocheterDialogOpen}
        onClose={() => setCrocheterDialogOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Manage Crocheter List (CSV)</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Upload or update the list of crocheters who make items. This list
              is shared across all public review submissions.
            </Typography>

            {crocheterError && <Alert severity="error">{crocheterError}</Alert>}

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              alignItems={{ xs: "stretch", sm: "center" }}
            >
              <input
                ref={crocheterFileInputRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: "none" }}
                onChange={handleCrocheterFileUpload}
              />
              <Button
                variant="contained"
                startIcon={<UploadFileOutlined />}
                onClick={() => crocheterFileInputRef.current?.click()}
              >
                Upload CSV
              </Button>
              <Button
                variant="outlined"
                onClick={() => setCrocheterDraft(CROCHETER_NAMES)}
              >
                Reset to Default Dummy List
              </Button>
              <Button
                variant="text"
                startIcon={<FileDownloadOutlined />}
                onClick={handleDownloadCrocheterDummyCsv}
              >
                Download Dummy CSV
              </Button>
            </Stack>

            <Divider />

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Crocheters Preview ({crocheterDraft.length} names)
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5,
                  maxHeight: 220,
                  overflowY: "auto",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 0.8,
                }}
              >
                {crocheterDraft.map((name, idx) => (
                  <Chip
                    key={`${name}-${idx}`}
                    label={name}
                    size="small"
                    onDelete={() =>
                      setCrocheterDraft((prev) =>
                        prev.filter((_, i) => i !== idx),
                      )
                    }
                  />
                ))}
              </Paper>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCrocheterDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveCrocheters}
            disabled={crocheterSaving}
          >
            {crocheterSaving ? "Saving…" : "Save Crocheter List"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manage Items (JSON) Dialog */}
      <Dialog
        open={itemDialogOpen}
        onClose={() => setItemDialogOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Manage Item List (JSON)</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Upload or update the shop product list. Customers will select the
              item name from this list in the review form, linking the handle
              (SKU) behind the scenes.
            </Typography>

            {itemError && <Alert severity="error">{itemError}</Alert>}

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              alignItems={{ xs: "stretch", sm: "center" }}
            >
              <input
                ref={itemFileInputRef}
                type="file"
                accept=".json,application/json"
                style={{ display: "none" }}
                onChange={handleItemFileUpload}
              />
              <Button
                variant="contained"
                startIcon={<UploadFileOutlined />}
                onClick={() => itemFileInputRef.current?.click()}
              >
                Upload JSON
              </Button>
              <Button
                variant="outlined"
                onClick={() => setItemDraft(DEFAULT_ITEMS)}
              >
                Reset to Default Dummy List
              </Button>
              <Button
                variant="text"
                startIcon={<FileDownloadOutlined />}
                onClick={handleDownloadItemDummyJson}
              >
                Download Dummy JSON
              </Button>
            </Stack>

            <Divider />

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Items Preview ({itemDraft.length} items)
              </Typography>
              <TableContainer
                component={Paper}
                variant="outlined"
                sx={{ maxHeight: 260 }}
              >
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Item Name / Title</TableCell>
                      <TableCell>Handle (SKU)</TableCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {itemDraft.map((item, idx) => (
                      <TableRow key={`${item.handle || item.title}-${idx}`}>
                        <TableCell>{item.title || item.name}</TableCell>
                        <TableCell
                          sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                        >
                          {item.handle}
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() =>
                              setItemDraft((prev) =>
                                prev.filter((_, i) => i !== idx),
                              )
                            }
                          >
                            <DeleteOutlined fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setItemDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveItems}
            disabled={itemSaving}
          >
            {itemSaving ? "Saving…" : "Save Item List"}
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
                {/* Footer: name left, EN/JP badge right */}
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
        message="Delete this review request? This cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <Snackbar
        open={!!toastMessage}
        autoHideDuration={4000}
        onClose={() => setToastMessage("")}
        message={toastMessage}
      />
    </Box>
  );
}
