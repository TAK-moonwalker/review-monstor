import { useState, useEffect, useRef } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControlLabel,
  MenuItem,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useSettings } from '../hooks/useSettings';
import { updateSettings } from '../firebase/settingsService';
import LoadingScreen from '../components/LoadingScreen';
import { useAuth } from '../hooks/useAuth';

const INITIAL = {
  couponEnabled: false,
  couponCode: '',
  thankYouMessage: '',
  reviewFormTitle: '',
  reviewFormDescription: '',
  defaultReviewStatus: 'pending',
  shopUrl: '',
  judgeMeLanguage: 'en',
};

const STATUS_OPTIONS = ['pending', 'ready', 'published', 'rejected'];

export default function Settings() {
  const { user } = useAuth();
  const { settings, loading } = useSettings();
  const [form, setForm] = useState(INITIAL);
  const initialized = useRef(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !initialized.current) {
      initialized.current = true;
      setForm({ ...INITIAL, ...settings });
    }
  }, [loading, settings]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await updateSettings(user.uid, form);
      setSuccess(true);
    } catch {
      setError('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <Box maxWidth={560}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Settings
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card variant="outlined">
        <CardContent>
          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={3}>

              {/* Coupon */}
              <Typography variant="subtitle1" fontWeight={600}>Coupon</Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={!!form.couponEnabled}
                    onChange={(e) => set('couponEnabled', e.target.checked)}
                  />
                }
                label="Enable coupon on thank-you page"
              />
              <TextField
                label="Coupon Code"
                value={form.couponCode}
                onChange={(e) => set('couponCode', e.target.value)}
                disabled={!form.couponEnabled}
                fullWidth
              />
              <TextField
                label="Thank You Message"
                value={form.thankYouMessage}
                onChange={(e) => set('thankYouMessage', e.target.value)}
                multiline
                minRows={2}
                fullWidth
                helperText="Shown on the thank-you page after a review is submitted"
              />

              {/* Review Form */}
              <Typography variant="subtitle1" fontWeight={600}>Review Form</Typography>
              <TextField
                label="Review Form Title"
                value={form.reviewFormTitle}
                onChange={(e) => set('reviewFormTitle', e.target.value)}
                fullWidth
              />
              <TextField
                label="Review Form Description"
                value={form.reviewFormDescription}
                onChange={(e) => set('reviewFormDescription', e.target.value)}
                multiline
                minRows={2}
                fullWidth
              />
              <TextField
                select
                label="Default Review Status"
                value={form.defaultReviewStatus}
                onChange={(e) => set('defaultReviewStatus', e.target.value)}
                fullWidth
                helperText="Status assigned to newly submitted reviews"
              >
                {STATUS_OPTIONS.map((s) => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </TextField>

              {/* Judge.me Export */}
              <Typography variant="subtitle1" fontWeight={600}>Judge.me Export</Typography>
              <TextField
                select
                label="Export Language"
                value={form.judgeMeLanguage}
                onChange={(e) => set('judgeMeLanguage', e.target.value)}
                fullWidth
                helperText="Language used for title and body when exporting to Judge.me CSV"
              >
                <MenuItem value="en">English (English site)</MenuItem>
                <MenuItem value="ja">Japanese (Japanese site)</MenuItem>
              </TextField>

              {/* Shop */}
              <Typography variant="subtitle1" fontWeight={600}>Shop</Typography>
              <TextField
                label="Shop URL"
                type="url"
                value={form.shopUrl}
                onChange={(e) => set('shopUrl', e.target.value)}
                fullWidth
                helperText="Link shown on the thank-you page"
              />

              <Button type="submit" variant="contained" disabled={saving}>
                {saving ? 'Saving…' : 'Save Settings'}
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      <Snackbar
        open={success}
        autoHideDuration={3000}
        onClose={() => setSuccess(false)}
        message="Settings saved!"
      />
    </Box>
  );
}
