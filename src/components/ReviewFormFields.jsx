import { useRef, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControlLabel,
  MenuItem,
  Rating,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import UploadFileOutlined from '@mui/icons-material/UploadFileOutlined';
import { uploadReviewImage } from '../firebase/storageService';

const SectionHeader = ({ title }) => (
  <Box sx={{ mt: 1 }}>
    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
      {title}
    </Typography>
    <Divider />
  </Box>
);

const field = (form, setForm) => (key) => (e) =>
  setForm((prev) => ({ ...prev, [key]: e.target.value }));

const toggle = (form, setForm) => (key) => (e) =>
  setForm((prev) => ({ ...prev, [key]: e.target.checked }));

export default function ReviewFormFields({ form, setForm }) {
  const f = field(form, setForm);
  const t = toggle(form, setForm);
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const { downloadURL } = await uploadReviewImage(file);
      setForm((prev) => ({ ...prev, postcardImageUrl: downloadURL }));
    } catch {
      setUploadError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Stack spacing={2.5}>

      {/* ── 1. Basic Info ─────────────────────────────────────────── */}
      <SectionHeader title="1. Basic Info" />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          select
          label="Source"
          value={form.source || ''}
          onChange={f('source')}
          fullWidth
        >
          {['manual', 'token', 'import', 'google', 'other'].map((v) => (
            <MenuItem key={v} value={v}>{v}</MenuItem>
          ))}
        </TextField>

        <TextField
          select
          label="Status"
          value={form.status || 'pending'}
          onChange={f('status')}
          fullWidth
        >
          <MenuItem value="published">Published</MenuItem>
          <MenuItem value="ready">Ready</MenuItem>
          <MenuItem value="pending">Pending</MenuItem>
          <MenuItem value="rejected">Rejected</MenuItem>
        </TextField>
      </Stack>

      <Box>
        <Typography variant="body2" gutterBottom>Rating</Typography>
        <Rating
          value={Number(form.rating) || 5}
          onChange={(_, val) => setForm((prev) => ({ ...prev, rating: val }))}
        />
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="Reviewer Name"
          value={form.reviewerName || ''}
          onChange={f('reviewerName')}
          fullWidth
          required
        />
        <TextField
          label="Reviewer Email"
          type="email"
          value={form.reviewerEmail || ''}
          onChange={f('reviewerEmail')}
          fullWidth
        />
      </Stack>

      <TextField
        label="Review Date"
        type="date"
        value={form.reviewDate || ''}
        onChange={f('reviewDate')}
        slotProps={{ inputLabel: { shrink: true } }}
        fullWidth
      />

      {/* ── 2. Product Mapping ────────────────────────────────────── */}
      <SectionHeader title="2. Product Mapping" />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="Product Handle"
          value={form.productHandle || ''}
          onChange={f('productHandle')}
          fullWidth
        />
        <TextField
          label="Product Title"
          value={form.productTitle || ''}
          onChange={f('productTitle')}
          fullWidth
        />
      </Stack>

      <FormControlLabel
        control={
          <Switch
            checked={!!form.isBrandTestimonial}
            onChange={t('isBrandTestimonial')}
          />
        }
        label="Brand Testimonial (not product-specific)"
      />

      {/* ── 3. Review Text ────────────────────────────────────────── */}
      <SectionHeader title="3. Review Text" />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="Japanese Title"
          value={form.titleJa || ''}
          onChange={f('titleJa')}
          fullWidth
        />
        <TextField
          label="English Title"
          value={form.titleEn || ''}
          onChange={f('titleEn')}
          fullWidth
        />
      </Stack>

      <TextField
        label="Japanese Body"
        value={form.bodyJa || ''}
        onChange={f('bodyJa')}
        multiline
        rows={4}
        fullWidth
        required
      />

      <TextField
        label="English Body"
        value={form.bodyEn || ''}
        onChange={f('bodyEn')}
        multiline
        rows={4}
        fullWidth
      />

      <TextField
        label="Original Text (Japanese)"
        value={form.originalTextJa || ''}
        onChange={f('originalTextJa')}
        multiline
        rows={3}
        fullWidth
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="Short Quote (Japanese)"
          value={form.shortQuoteJa || ''}
          onChange={f('shortQuoteJa')}
          fullWidth
        />
        <TextField
          label="Short Quote (English)"
          value={form.shortQuoteEn || ''}
          onChange={f('shortQuoteEn')}
          fullWidth
        />
      </Stack>

      <TextField
        label="Reply"
        value={form.reply || ''}
        onChange={f('reply')}
        multiline
        rows={2}
        fullWidth
        helperText="Admin reply shown publicly"
      />

      {/* ── 4. Images ─────────────────────────────────────────────── */}
      <SectionHeader title="4. Images" />

      {/* Upload button */}
      <Box>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <Button
          variant="outlined"
          startIcon={uploading ? <CircularProgress size={16} /> : <UploadFileOutlined />}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Uploading…' : 'Upload Postcard Image'}
        </Button>
        {uploadError && (
          <Typography variant="caption" color="error" display="block" sx={{ mt: 0.5 }}>
            {uploadError}
          </Typography>
        )}
      </Box>

      {/* Preview */}
      {form.postcardImageUrl && (
        <Box
          component="img"
          src={form.postcardImageUrl}
          alt="Postcard preview"
          sx={{ maxWidth: '100%', maxHeight: 200, borderRadius: 1, objectFit: 'contain' }}
        />
      )}

      {/* Manual URL fallback */}
      <TextField
        label="Postcard Image URL"
        value={form.postcardImageUrl || ''}
        onChange={f('postcardImageUrl')}
        fullWidth
        helperText="Or paste a Shopify / WordPress hosted URL directly"
      />

      <TextField
        label="Picture URLs"
        value={
          Array.isArray(form.pictureUrls)
            ? form.pictureUrls.join(', ')
            : form.pictureUrls || ''
        }
        onChange={(e) =>
          setForm((prev) => ({
            ...prev,
            pictureUrls: e.target.value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          }))
        }
        fullWidth
        helperText="Comma-separated URLs"
      />

      {/* ── 5. Permission / Export ────────────────────────────────── */}
      <SectionHeader title="5. Permission / Export" />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <FormControlLabel
          control={
            <Switch
              checked={!!form.verified}
              onChange={t('verified')}
            />
          }
          label="Verified Purchase"
        />
        <FormControlLabel
          control={
            <Switch
              checked={!!form.permissionGranted}
              onChange={t('permissionGranted')}
            />
          }
          label="Permission Granted"
        />
      </Stack>

    </Stack>
  );
}

