import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Container,
  FormControlLabel,
  Rating,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getReviewRequestByToken } from '../firebase/requestService';
import { getSettings } from '../firebase/settingsService';

const INITIAL = {
  rating: 5,
  reviewerName: '',
  reviewerEmail: '',
  title: '',
  body: '',
  permissionGranted: false,
};

export default function PublicReviewForm() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [settings, setSettings] = useState({});
  const [pageStatus, setPageStatus] = useState('loading'); // loading | valid | used | invalid
  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([getReviewRequestByToken(token), getSettings()]).then(([req, s]) => {
      setSettings(s);
      if (!req) { setPageStatus('invalid'); return; }
      if (req.used) { setPageStatus('used'); return; }
      if (req.expiresAt) {
        const expires = req.expiresAt?.toDate ? req.expiresAt.toDate() : new Date(req.expiresAt);
        if (expires < new Date()) { setPageStatus('invalid'); return; }
      }
      setRequest(req);
      setForm((prev) => ({
        ...prev,
        reviewerName: req.customerName || '',
        reviewerEmail: req.customerEmail || '',
      }));
      setPageStatus('valid');
    });
  }, [token]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const validate = () => {
    const e = {};
    if (!form.rating) e.rating = 'Please select a rating';
    if (!form.body.trim()) e.body = 'Please write your review';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      const functions = getFunctions();
      const submitReviewByToken = httpsCallable(functions, 'submitReviewByToken');
      const { data } = await submitReviewByToken({
        token,
        reviewerName: form.reviewerName,
        reviewerEmail: form.reviewerEmail,
        rating: form.rating,
        title: form.title,
        body: form.body,
        permissionGranted: form.permissionGranted,
      });
      navigate('/thank-you', {
        state: {
          couponEnabled: data.couponEnabled,
          couponCode: data.couponCode,
          thankYouMessage: data.thankYouMessage,
        },
      });
    } catch (err) {
      const msg = err?.message || 'Failed to submit. Please try again.';
      setErrors({ form: msg });
      setSubmitting(false);
    }
  };

  if (pageStatus === 'loading') {
    return (
      <Container maxWidth="sm" sx={{ mt: 10, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (pageStatus === 'used') {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Alert severity="info">This review has already been submitted. Thank you!</Alert>
      </Container>
    );
  }

  if (pageStatus === 'invalid') {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Alert severity="error">This review link is invalid or has expired.</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 4, mb: 6 }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          {settings.reviewFormTitle || 'Write a Review'}
        </Typography>
        {settings.reviewFormDescription && (
          <Typography color="text.secondary" sx={{ mb: 1 }}>
            {settings.reviewFormDescription}
          </Typography>
        )}
        {request.productTitle && (
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Product: {request.productTitle}
          </Typography>
        )}

        {errors.form && (
          <Alert severity="error" sx={{ mb: 2 }}>{errors.form}</Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
          <Stack spacing={3}>

            {/* Rating */}
            <Box>
              <Typography variant="body2" fontWeight={500} gutterBottom>
                Rating *
              </Typography>
              <Rating
                size="large"
                value={form.rating}
                onChange={(_, val) => set('rating', val)}
              />
              {errors.rating && (
                <Typography color="error" variant="caption" display="block">
                  {errors.rating}
                </Typography>
              )}
            </Box>

            <TextField
              label="Your Name"
              value={form.reviewerName}
              onChange={(e) => set('reviewerName', e.target.value)}
              fullWidth
            />
            <TextField
              label="Your Email"
              type="email"
              value={form.reviewerEmail}
              onChange={(e) => set('reviewerEmail', e.target.value)}
              fullWidth
            />
            <TextField
              label="Review Title"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              fullWidth
            />
            <TextField
              label="Your Review *"
              value={form.body}
              onChange={(e) => set('body', e.target.value)}
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
                  onChange={(e) => set('permissionGranted', e.target.checked)}
                />
              }
              label="I give permission to use my review for marketing purposes"
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={submitting}
            >
              {submitting ? 'Submitting…' : 'Submit Review'}
            </Button>
          </Stack>
        </Box>
      </Box>
    </Container>
  );
}
