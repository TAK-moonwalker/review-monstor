import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { getReview, updateReview } from '../firebase/reviewService';
import ReviewFormFields from '../components/ReviewFormFields';
import LoadingScreen from '../components/LoadingScreen';

export default function ReviewEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    getReview(id).then((data) => {
      if (data) setForm(data);
      else setNotFound(true);
    });
  }, [id]);

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
      await updateReview(id, form);
      showSnackbar('Review updated successfully!');
      setTimeout(() => navigate('/reviews'), 1200);
    } catch {
      showSnackbar('Failed to update review. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!form && !notFound) return <LoadingScreen />;

  if (notFound) {
    return (
      <Box maxWidth={760}>
        <Alert severity="error">
          Review not found. It may have been deleted.{' '}
          <Button size="small" onClick={() => navigate('/reviews')}>
            Back to Reviews
          </Button>
        </Alert>
      </Box>
    );
  }

  return (
    <Box maxWidth={760}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Edit Review
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
                {loading ? 'Saving...' : 'Update Review'}
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

