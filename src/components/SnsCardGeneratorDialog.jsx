import { useState, useRef } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
} from '@mui/material';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import { toJpeg } from 'html-to-image';

// Rendered at 540px wide; pixelRatio:2 → 1080px wide output
// Editorial Split is 4:5 → 540×675 rendered → 1080×1350 exported
const CARD_SIZE       = 540;
const EDITORIAL_HEIGHT = Math.round(CARD_SIZE * 5 / 4); // 675

// Warm neutral palette — premium Japanese lifestyle brand
const CREAM     = '#faf8f4';
const LINEN     = '#e8e0d5';
const DARK      = '#2d2926';
const WARM_GRAY = '#6b6560';
const GOLD      = '#c8a96e';

const LAYOUT_OPTIONS = [
  { value: 'minimal-white',   label: 'Minimal White' },
  { value: 'full-photo',      label: 'Full Photo Background' },
  { value: 'editorial-split', label: 'Editorial Split' },
];

const TEXT_OPTIONS = [
  { value: 'shortQuote',    label: 'Short Quote' },
  { value: 'translationEn', label: 'English Translation' },
  { value: 'cleanedTextJa', label: 'Cleaned Japanese' },
  { value: 'custom',        label: 'Custom Text' },
];

export default function SnsCardGeneratorDialog({ open, onClose, review }) {
  const cardRef = useRef(null);

  const [layout, setLayout]                   = useState('minimal-white');
  const [textMode, setTextMode]               = useState('shortQuote');
  const [customText, setCustomText]           = useState('');
  const [imageMode, setImageMode]             = useState(() => {
    if (review?.postcardImageUrl) return 'postcardImageUrl';
    if (review?.pictureUrls?.[0]) return 'firstPictureUrl';
    return 'none';
  });
  const [customImageUrl, setCustomImageUrl]   = useState('');
  const [brandName, setBrandName]             = useState('Review Monster');
  const [showRating, setShowRating]           = useState(true);
  const [showName, setShowName]               = useState(true);
  const [downloading, setDownloading]         = useState(false);

  if (!review) return null;

  const displayText =
    textMode === 'custom' ? customText : review[textMode] || '';

  const displayImageUrl = (() => {
    if (imageMode === 'postcardImageUrl') return review.postcardImageUrl || '';
    if (imageMode === 'firstPictureUrl') return review.pictureUrls?.[0] || '';
    if (imageMode === 'custom') return customImageUrl;
    return '';
  })();

  const hasImage = !!displayImageUrl;
  const rating = Number(review.rating) || 0;

  // Only show image options that exist on this review
  const imageOptions = [
    ...(review.postcardImageUrl ? [{ value: 'postcardImageUrl', label: 'Postcard Image' }] : []),
    ...(review.pictureUrls?.[0] ? [{ value: 'firstPictureUrl',  label: 'First Picture'  }] : []),
    { value: 'none',   label: 'No Image' },
    { value: 'custom', label: 'Custom URL' },
  ];

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toJpeg(cardRef.current, { quality: 0.95, pixelRatio: 2 });
      const date = new Date().toISOString().slice(0, 10);
      const slug = (review.id || review.reviewerName || 'review').replace(/\s+/g, '-');
      const a = document.createElement('a');
      a.download = `review-card-${layout}-${slug}-${date}.jpg`;
      a.href = dataUrl;
      a.click();
    } catch (err) {
      console.error('SNS card export failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  // Adaptive font size based on text length
  const fontSize =
    displayText.length > 120 ? 18
    : displayText.length > 70  ? 21
    : displayText.length > 40  ? 24
    : 28;

  // Star row helper (plain function, not a component)
  const renderStars = (fillColor, emptyColor) =>
    Array.from({ length: 5 }).map((_, i) => (
      <span
        key={i}
        style={{ fontSize: 20, color: i < rating ? fillColor : emptyColor, marginRight: 2 }}
      >★</span>
    ));

  // ─────────────────────────────────────────────────────────────
  // Layout 1 — Minimal White
  //   Warm cream background, large decorative quote mark,
  //   Georgia serif italic text, gold accent lines.
  // ─────────────────────────────────────────────────────────────
  const cardMinimalWhite = (
    <div style={{
      width: CARD_SIZE, height: CARD_SIZE,
      position: 'relative', overflow: 'hidden',
      backgroundColor: CREAM,
      fontFamily: 'Georgia, "Hiragino Mincho ProN", serif',
    }}>
      {/* Top gold accent bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 3, backgroundColor: GOLD,
      }} />

      {/* Brand name — top left */}
      {brandName && (
        <div style={{
          position: 'absolute', top: 26, left: 36, right: 36,
          color: WARM_GRAY, fontSize: 10, fontWeight: 700,
          letterSpacing: 3.5, textTransform: 'uppercase',
          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
        }}>
          {brandName}
        </div>
      )}

      {/* Decorative large quote mark */}
      <div style={{
        position: 'absolute', top: 52, left: 26,
        fontSize: 170, lineHeight: 1,
        color: LINEN, fontFamily: 'Georgia, serif',
        userSelect: 'none', pointerEvents: 'none',
      }}>
        &#8220;
      </div>

      {/* Main content — vertically centered */}
      <div style={{
        position: 'absolute', top: 90, left: 36, right: 36, bottom: 56,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}>
        {showRating && rating > 0 && (
          <div style={{ marginBottom: 18 }}>{renderStars(GOLD, LINEN)}</div>
        )}
        <div style={{
          color: DARK, fontSize, fontStyle: 'italic',
          lineHeight: 1.68, marginBottom: 24,
        }}>
          {displayText
            ? `\u201C${displayText}\u201D`
            : <span style={{ color: LINEN }}>No text selected</span>}
        </div>
        {showName && review.reviewerName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 1, backgroundColor: GOLD, flexShrink: 0 }} />
            <div style={{
              color: WARM_GRAY, fontSize: 12, letterSpacing: 1,
              fontFamily: '"Helvetica Neue", Arial, sans-serif',
            }}>
              {review.reviewerName}
            </div>
          </div>
        )}
      </div>

      {/* Bottom-right subtle brand repeat */}
      <div style={{
        position: 'absolute', bottom: 22, right: 36,
        color: LINEN, fontSize: 10, letterSpacing: 2.5,
        textTransform: 'uppercase',
        fontFamily: '"Helvetica Neue", Arial, sans-serif',
      }}>
        {brandName}
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  // Layout 2 — Full Photo Background
  //   Photo fills the square. Heavy bottom vignette keeps text
  //   legible. Brand mark top-left; gold line top-right.
  // ─────────────────────────────────────────────────────────────
  const cardFullPhoto = (
    <div style={{
      width: CARD_SIZE, height: CARD_SIZE,
      position: 'relative', overflow: 'hidden',
      backgroundColor: '#1a1714',
      fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    }}>
      {/* Background photo */}
      {hasImage && (
        <img
          src={displayImageUrl}
          alt=""
          crossOrigin="anonymous"
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%', objectFit: 'cover',
          }}
        />
      )}

      {/* Top vignette — brand legibility */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(20,16,12,0.60) 0%, transparent 38%)',
      }} />

      {/* Bottom vignette — text legibility */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(20,16,12,0.92) 0%, rgba(20,16,12,0.52) 44%, transparent 68%)',
      }} />

      {/* Brand name — top left */}
      {brandName && (
        <div style={{
          position: 'absolute', top: 28, left: 32,
          color: 'rgba(255,255,255,0.90)',
          fontSize: 10, fontWeight: 700, letterSpacing: 3.5, textTransform: 'uppercase',
        }}>
          {brandName}
        </div>
      )}

      {/* Gold accent line — top right */}
      <div style={{
        position: 'absolute', top: 33, right: 32,
        width: 36, height: 2, backgroundColor: GOLD,
      }} />

      {/* Text content — bottom */}
      <div style={{ position: 'absolute', bottom: 38, left: 36, right: 36 }}>
        {showRating && rating > 0 && (
          <div style={{ marginBottom: 14 }}>
            {renderStars(GOLD, 'rgba(255,255,255,0.20)')}
          </div>
        )}
        <div style={{
          color: '#ffffff', fontSize, fontWeight: 400,
          lineHeight: 1.62, marginBottom: 18,
          fontFamily: 'Georgia, serif', fontStyle: 'italic',
        }}>
          {displayText ? `\u201C${displayText}\u201D` : ''}
        </div>
        {showName && review.reviewerName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 20, height: 1, backgroundColor: 'rgba(255,255,255,0.50)', flexShrink: 0 }} />
            <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 12, letterSpacing: 1 }}>
              {review.reviewerName}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  // Layout 3 — Editorial Split  (4:5 vertical, 1080×1350 export)
  //   Top: true 1:1 square photo (540×540 rendered)
  //   Bottom: cream text panel (540×135 rendered = 270px exported)
  //   No overlap — clean hard edge between image and text.
  // ─────────────────────────────────────────────────────────────
  const textPanelH = EDITORIAL_HEIGHT - CARD_SIZE; // 135px

  const cardEditorialSplit = (
    <div style={{
      width: CARD_SIZE, height: EDITORIAL_HEIGHT,
      display: 'flex', flexDirection: 'column',
      backgroundColor: CREAM,
      fontFamily: 'Georgia, serif',
      overflow: 'hidden',
    }}>
      {/* ── Square photo block (1:1) ── */}
      <div style={{
        width: CARD_SIZE, height: CARD_SIZE, flexShrink: 0,
        position: 'relative', overflow: 'hidden',
        backgroundColor: hasImage ? '#1a1714' : LINEN,
      }}>
        {hasImage && (
          <img
            src={displayImageUrl}
            alt=""
            crossOrigin="anonymous"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}

        {/* Top vignette for brand legibility */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 70,
          background: 'linear-gradient(to bottom, rgba(20,16,12,0.45), transparent)',
        }} />

        {/* Brand name — top left of photo */}
        {brandName && (
          <div style={{
            position: 'absolute', top: 20, left: 28,
            color: hasImage ? 'rgba(255,255,255,0.90)' : WARM_GRAY,
            fontSize: 10, fontWeight: 700, letterSpacing: 3.5, textTransform: 'uppercase',
            fontFamily: '"Helvetica Neue", Arial, sans-serif',
          }}>
            {brandName}
          </div>
        )}
      </div>

      {/* ── Text panel — full width, sits cleanly below photo ── */}
      <div style={{
        width: CARD_SIZE, height: textPanelH, flexShrink: 0,
        backgroundColor: CREAM,
        borderTop: `3px solid ${GOLD}`,
        padding: '12px 32px 10px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}>
        {/* Stars + reviewer name on same row to save vertical space */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 8,
        }}>
          {showRating && rating > 0 && (
            <div>{renderStars(GOLD, LINEN)}</div>
          )}
          {showName && review.reviewerName && (
            <div style={{
              color: WARM_GRAY, fontSize: 10, letterSpacing: 1,
              fontFamily: '"Helvetica Neue", Arial, sans-serif',
            }}>
              {review.reviewerName}
            </div>
          )}
        </div>

        {/* Quote text */}
        <div style={{
          color: DARK,
          fontSize: Math.min(fontSize, 15),
          fontStyle: 'italic', lineHeight: 1.55,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
        }}>
          {displayText
            ? `\u201C${displayText}\u201D`
            : <span style={{ color: LINEN }}>No text selected</span>}
        </div>
      </div>
    </div>
  );

  // Card height varies by layout
  const cardHeight = layout === 'editorial-split' ? EDITORIAL_HEIGHT : CARD_SIZE;

  // Active layout
  const cardContent =
    layout === 'full-photo'        ? cardFullPhoto
    : layout === 'editorial-split' ? cardEditorialSplit
    : cardMinimalWhite;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>SNS Card Generator</DialogTitle>
      <DialogContent>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ mt: 1 }}>

          {/* ── Controls ── */}
          <Stack spacing={2} sx={{ minWidth: 220, flexShrink: 0 }}>

            <TextField
              select
              label="Layout"
              value={layout}
              onChange={(e) => setLayout(e.target.value)}
              size="small"
              fullWidth
            >
              {LAYOUT_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </TextField>

            <Divider />

            <TextField
              select
              label="Review Text"
              value={textMode}
              onChange={(e) => setTextMode(e.target.value)}
              size="small"
              fullWidth
            >
              {TEXT_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </TextField>

            {textMode === 'custom' && (
              <TextField
                label="Custom Text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                multiline
                rows={3}
                size="small"
                fullWidth
              />
            )}

            <Divider />

            <TextField
              select
              label="Background Image"
              value={imageMode}
              onChange={(e) => setImageMode(e.target.value)}
              size="small"
              fullWidth
            >
              {imageOptions.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </TextField>

            {imageMode === 'custom' && (
              <TextField
                label="Image URL"
                value={customImageUrl}
                onChange={(e) => setCustomImageUrl(e.target.value)}
                size="small"
                fullWidth
                placeholder="https://..."
              />
            )}

            <Divider />

            <TextField
              label="Brand Name"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              size="small"
              fullWidth
            />
            <FormControlLabel
              control={
                <Switch
                  checked={showRating}
                  onChange={(e) => setShowRating(e.target.checked)}
                  size="small"
                />
              }
              label="Show Rating"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={showName}
                  onChange={(e) => setShowName(e.target.checked)}
                  size="small"
                />
              }
              label="Show Reviewer Name"
            />
          </Stack>

          {/* ── Preview ── */}
          <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', overflow: 'auto' }}>
            <Box sx={{
              boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
              borderRadius: 2,
              overflow: 'hidden',
              flexShrink: 0,
            }}>
              {/* cardRef size adapts to layout — editorial-split is taller (4:5) */}
              <div ref={cardRef} style={{ width: CARD_SIZE, height: cardHeight, overflow: 'hidden' }}>
                {cardContent}
              </div>
            </Box>
          </Box>

        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button
          variant="contained"
          startIcon={
            downloading
              ? <CircularProgress size={16} color="inherit" />
              : <DownloadOutlined />
          }
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading ? 'Generating…' : 'Download JPEG'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
