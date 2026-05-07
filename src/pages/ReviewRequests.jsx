import { useState } from 'react';
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
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import QrCode2Outlined from '@mui/icons-material/QrCode2Outlined';
import { QRCodeSVG } from 'qrcode.react';
import { useReviewRequests } from '../hooks/useReviewRequests';
import { createReviewRequest, deleteReviewRequest } from '../firebase/requestService';
import { generateToken } from '../utils/generateToken';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingScreen from '../components/LoadingScreen';
import EmptyState from '../components/EmptyState';
import { formatDate } from '../utils/dateUtils';

const BASE_URL = `${window.location.origin}/review`;

const INITIAL_FORM = {
  customerName: '',
  customerEmail: '',
  orderNumber: '',
  productHandle: '',
  productTitle: '',
  expiresAt: '',
};

export default function ReviewRequests() {
  const { requests, loading } = useReviewRequests();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [qrTarget, setQrTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  if (loading) return <LoadingScreen />;

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleCreate = async () => {
    setSaving(true);
    const token = generateToken();
    const expiresAt = form.expiresAt ? new Date(form.expiresAt) : null;
    await createReviewRequest({ ...form, token, expiresAt });
    setForm(INITIAL_FORM);
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

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          Review Requests
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
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
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {req.customerName || 'Anonymous'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {req.customerEmail}
                      </Typography>
                    </Box>
                    <Chip
                      label={req.used ? 'Used' : 'Pending'}
                      color={req.used ? 'default' : 'success'}
                      size="small"
                    />
                  </Stack>

                  {(req.productTitle || req.productHandle) && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {req.productTitle}{req.productHandle ? ` (${req.productHandle})` : ''}
                    </Typography>
                  )}
                  {req.orderNumber && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Order: {req.orderNumber}
                    </Typography>
                  )}

                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    Created: {formatDate(req.createdAt)}
                    {req.expiresAt && ` · Expires: ${formatDate(req.expiresAt)}`}
                  </Typography>

                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Tooltip title="Copy review link">
                      <IconButton size="small" onClick={() => copyLink(req.token)}>
                        <ContentCopyOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Show QR code">
                      <IconButton size="small" onClick={() => setQrTarget(req)}>
                        <QrCode2Outlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete request">
                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(req)}>
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>New Review Request</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Customer Name" value={form.customerName} onChange={(e) => set('customerName', e.target.value)} fullWidth />
            <TextField label="Customer Email" type="email" value={form.customerEmail} onChange={(e) => set('customerEmail', e.target.value)} fullWidth />
            <TextField label="Order Number" value={form.orderNumber} onChange={(e) => set('orderNumber', e.target.value)} fullWidth />
            <TextField label="Product Handle" value={form.productHandle} onChange={(e) => set('productHandle', e.target.value)} fullWidth />
            <TextField label="Product Title" value={form.productTitle} onChange={(e) => set('productTitle', e.target.value)} fullWidth />
            <TextField
              label="Expires At"
              type="date"
              value={form.expiresAt}
              onChange={(e) => set('expiresAt', e.target.value)}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={!!qrTarget} onClose={() => setQrTarget(null)}>
        <DialogTitle>QR Code</DialogTitle>
        <DialogContent>
          <Stack alignItems="center" spacing={2} sx={{ p: 2 }}>
            {qrTarget && (
              <>
                <QRCodeSVG value={`${BASE_URL}/${qrTarget.token}`} size={200} />
                <Typography variant="caption" color="text.secondary">
                  {`${BASE_URL}/${qrTarget.token}`}
                </Typography>
                <Button startIcon={<ContentCopyOutlined />} onClick={() => copyLink(qrTarget.token)}>
                  Copy Link
                </Button>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQrTarget(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Request"
        message={`Delete review request for ${deleteTarget?.customerName || 'this customer'}? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
