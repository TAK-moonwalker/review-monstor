import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined';
import { useReviews } from '../hooks/useReviews';
import { useAuth } from '../hooks/useAuth';
import LoadingScreen from '../components/LoadingScreen';
import { generateShopifyReviewHtml } from '../utils/generateShopifyReviewHtml';

const TEXT_SOURCE_OPTIONS = [
  { value: 'shortQuoteJa', label: 'shortQuoteJa' },
  { value: 'shortQuoteEn', label: 'shortQuoteEn' },
  { value: 'translationEn', label: 'translationEn' },
  { value: 'cleanedTextJa', label: 'cleanedTextJa' },
  { value: 'body', label: 'body' },
];

const IMAGE_SOURCE_OPTIONS = [
  { value: 'postcardImageUrl', label: 'postcardImageUrl' },
  { value: 'firstPictureUrl', label: 'firstPictureUrl' },
];

const LAYOUT_OPTIONS = [
  { value: 'grid', label: 'grid' },
  { value: 'horizontal', label: 'carousel-like horizontal scroll' },
];

const THEME_OPTIONS = [
  { value: 'minimal', label: 'minimal' },
  { value: 'warm', label: 'warm' },
  { value: 'editorial', label: 'editorial' },
];

const INITIAL_OPTIONS = {
  cardCount: 6,
  apiEndpoint: 'https://us-central1-review-monster-80750.cloudfunctions.net/publicReviews',
  fullWidth: false,
  textSource: 'shortQuoteEn',
  imageSource: 'postcardImageUrl',
  sectionTitle: 'Customer Reviews',
  brandLabel: 'Review Monster',
  layout: 'grid',
  theme: 'minimal',
  showReviewerName: true,
  showRating: true,
  showProductTitle: false,
  onlyPermissionGranted: true,
  onlyReadyPublished: true,
};

function countEligibleReviews(reviews, options) {
  return (Array.isArray(reviews) ? reviews : [])
    .filter((review) => {
      if (options.onlyPermissionGranted && review?.permissionGranted !== true) return false;
      if (options.onlyReadyPublished) {
        const status = String(review?.status || '').toLowerCase();
        if (status !== 'ready' && status !== 'published') return false;
      }
      const text = typeof review?.[options.textSource] === 'string' ? review[options.textSource].trim() : '';
      const image = options.imageSource === 'firstPictureUrl'
        ? (typeof review?.pictureUrls?.[0] === 'string' ? review.pictureUrls[0].trim() : '')
        : (typeof review?.postcardImageUrl === 'string' ? review.postcardImageUrl.trim() : '');
      return !!text && !!image;
    })
    .length;
}

export default function HtmlCodeGenerator() {
  const { user } = useAuth();
  const { reviews, loading, error } = useReviews();
  const [options, setOptions] = useState(INITIAL_OPTIONS);
  const [copyMessage, setCopyMessage] = useState('');

  const optionsWithOwner = useMemo(
    () => ({ ...options, ownerUid: typeof user?.uid === 'string' ? user.uid : '' }),
    [options, user?.uid],
  );

  const eligibleCount = useMemo(() => countEligibleReviews(reviews, optionsWithOwner), [reviews, optionsWithOwner]);
  const generatedCode = useMemo(() => generateShopifyReviewHtml(reviews, optionsWithOwner), [reviews, optionsWithOwner]);

  if (loading) return <LoadingScreen />;

  const handleChange = (key) => (event) => {
    const value = event.target.value;
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  const handleCheck = (key) => (event) => {
    const checked = event.target.checked;
    setOptions((prev) => ({ ...prev, [key]: checked }));
  };

  const handleCopy = async () => {
    if (!generatedCode) return;
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopyMessage('Code copied to clipboard.');
    } catch {
      setCopyMessage('Could not copy automatically. Select and copy from the textarea.');
    }
  };

  const handleDownload = () => {
    if (!generatedCode) return;
    const blob = new Blob([generatedCode], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'shopify-reviews-section.html';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenPreview = () => {
    if (!generatedCode) return;
    const previewWindow = window.open('', '_blank');
    if (!previewWindow) return;

    previewWindow.document.open();
    previewWindow.document.write(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Shopify Review Preview</title>
    <style>
      body {
        margin: 0;
        padding: 24px;
        background: #f6f7f8;
      }
    </style>
  </head>
  <body>${generatedCode}</body>
</html>`);
    previewWindow.document.close();
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        HTML Code Generator
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Generate standalone HTML/CSS/JS for Shopify Custom Liquid from your existing Firebase reviews.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load reviews: {String(error.message || error)}
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Settings
              </Typography>

              <Stack spacing={2}>
                <TextField
                  label="Number of cards"
                  type="number"
                  value={options.cardCount}
                  onChange={handleChange('cardCount')}
                  slotProps={{ htmlInput: { min: 1, max: 50 } }}
                  size="small"
                  fullWidth
                />

                <TextField
                  label="Reviews API endpoint"
                  value={options.apiEndpoint}
                  onChange={handleChange('apiEndpoint')}
                  size="small"
                  fullWidth
                  helperText="Shopify snippet calls this endpoint at runtime with your owner uid."
                />

                <TextField
                  select
                  label="Text source"
                  value={options.textSource}
                  onChange={handleChange('textSource')}
                  size="small"
                  fullWidth
                >
                  {TEXT_SOURCE_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                  ))}
                </TextField>

                <TextField
                  select
                  label="Image source"
                  value={options.imageSource}
                  onChange={handleChange('imageSource')}
                  size="small"
                  fullWidth
                >
                  {IMAGE_SOURCE_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                  ))}
                </TextField>

                <TextField
                  label="Section title"
                  value={options.sectionTitle}
                  onChange={handleChange('sectionTitle')}
                  size="small"
                  fullWidth
                />

                <TextField
                  label="Brand label"
                  value={options.brandLabel}
                  onChange={handleChange('brandLabel')}
                  size="small"
                  fullWidth
                />

                <TextField
                  select
                  label="Layout"
                  value={options.layout}
                  onChange={handleChange('layout')}
                  size="small"
                  fullWidth
                >
                  {LAYOUT_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                  ))}
                </TextField>

                <TextField
                  select
                  label="Theme"
                  value={options.theme}
                  onChange={handleChange('theme')}
                  size="small"
                  fullWidth
                >
                  {THEME_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                  ))}
                </TextField>

                <FormControlLabel
                  control={<Checkbox checked={options.showReviewerName} onChange={handleCheck('showReviewerName')} />}
                  label="Show reviewer name"
                />
                <FormControlLabel
                  control={<Checkbox checked={options.showRating} onChange={handleCheck('showRating')} />}
                  label="Show rating"
                />
                <FormControlLabel
                  control={<Checkbox checked={options.showProductTitle} onChange={handleCheck('showProductTitle')} />}
                  label="Show product title"
                />
                <FormControlLabel
                  control={<Checkbox checked={options.fullWidth} onChange={handleCheck('fullWidth')} />}
                  label="Full width"
                />
                <FormControlLabel
                  control={<Checkbox checked={options.onlyPermissionGranted} onChange={handleCheck('onlyPermissionGranted')} />}
                  label="Only permissionGranted reviews"
                />
                <FormControlLabel
                  control={<Checkbox checked={options.onlyReadyPublished} onChange={handleCheck('onlyReadyPublished')} />}
                  label="Only ready/published reviews"
                />

                <Alert severity="info">
                  Eligible reviews with current settings: {eligibleCount}
                </Alert>

                {eligibleCount === 0 && (
                  <Alert severity="warning">
                    No eligible reviews found. Update filters or sources to generate storefront cards.
                  </Alert>
                )}

                <Alert severity="info">
                  Generated HTML now fetches live reviews from the API endpoint, so you do not hardcode all review JSON.
                </Alert>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <Stack spacing={2}>
            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={<ContentCopyOutlined />}
                    onClick={handleCopy}
                    disabled={!generatedCode}
                  >
                    Copy Code
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadOutlined />}
                    onClick={handleDownload}
                    disabled={!generatedCode}
                  >
                    Download .html file
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<OpenInNewOutlined />}
                    onClick={handleOpenPreview}
                    disabled={!generatedCode}
                  >
                    Open Preview Tab
                  </Button>
                </Stack>

                {copyMessage && (
                  <Alert severity="success" sx={{ mb: 1 }}>
                    {copyMessage}
                  </Alert>
                )}

                <TextField
                  multiline
                  minRows={18}
                  maxRows={30}
                  value={generatedCode}
                  slotProps={{ htmlInput: { readOnly: true } }}
                  placeholder="Generated Shopify-ready code appears here"
                  fullWidth
                />
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <Alert severity="info">
                  Use Open Preview Tab to inspect the generated HTML in a separate browser tab.
                </Alert>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
