import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import { createReview } from '../firebase/reviewService';
import ReviewFormFields from '../components/ReviewFormFields';

const INITIAL = {
  source: 'manual',
  status: 'pending',
  rating: 5,
  reviewerName: '',
  reviewerEmail: '',
  productHandle: '',
  productTitle: '',
  isBrandTestimonial: false,
  title: '',
  originalTextJa: '',
  cleanedTextJa: '',
  translationEn: '',
  body: '',
  shortQuote: '',
  postcardImageUrl: '',
  pictureUrls: [],
  verified: false,
  permissionGranted: false,
  reply: '',
  reviewDate: '',
};

export default function ReviewForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const showSnackbar = (message, severity = 'success') =>
    setSnackbar({ open: true, message, severity });

  const validate = () => {
    if (!form.reviewerName) { showSnackbar('Reviewer name is required.', 'error'); return false; }
    if (!form.body) { showSnackbar('Review body is required.', 'error'); return false; }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await createReview(form);
      showSnackbar('Review saved successfully!');
      setTimeout(() => navigate('/reviews'), 1200);
    } catch {
      showSnackbar('Failed to save review. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box maxWidth={760}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Add Review
      </Typography>

      <Card variant="outlined">
        <CardContent sx={{ p: 3 }}>
          <Box component="form" onSubmit={handleSubmit}>
            <ReviewFormFields form={form} setForm={setForm} />

            <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ mt: 4 }}>
              <Button variant="outlined" onClick={() => navigate('/reviews')} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={loading}>
                {loading ? 'Saving...' : 'Save Review'}
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

