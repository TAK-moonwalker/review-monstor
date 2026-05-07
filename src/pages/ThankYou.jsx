import { useState } from 'react';
import { useLocation } from 'react-router-dom';
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
} from '@mui/material';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import { useSettings } from '../hooks/useSettings';

export default function ThankYou() {
  const location = useLocation();
  const { settings, loading } = useSettings();
  const [copied, setCopied] = useState(false);

  // Prefer values passed via router state, fall back to live settings
  const state = location.state || {};
  const couponEnabled = state.couponEnabled ?? settings.couponEnabled;
  const couponCode = state.couponCode ?? settings.couponCode;
  const thankYouMessage = state.thankYouMessage ?? settings.thankYouMessage;

  const handleCopy = () => {
    navigator.clipboard.writeText(couponCode);
    setCopied(true);
  };

  return (
    <Container maxWidth="xs">
      <Box sx={{ mt: 8, mb: 6, textAlign: 'center' }}>
        <CheckCircleOutlined sx={{ fontSize: 72, color: 'success.main', mb: 2 }} />

        <Typography variant="h4" fontWeight={700} gutterBottom>
          Thank You!
        </Typography>

        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {thankYouMessage || 'Your review has been submitted successfully.'}
        </Typography>

        {!loading && couponEnabled && couponCode && (
          <Card variant="outlined" sx={{ mt: 2, mb: 3 }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Here is your exclusive coupon code:
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
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
                <Tooltip title="Copy code">
                  <IconButton size="small" onClick={handleCopy}>
                    <ContentCopyOutlined fontSize="small" />
                  </IconButton>
                </Tooltip>
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
            Back to Shop
          </Button>
        )}
      </Box>

      <Snackbar
        open={copied}
        autoHideDuration={2500}
        onClose={() => setCopied(false)}
        message="Coupon code copied!"
      />
    </Container>
  );
}
