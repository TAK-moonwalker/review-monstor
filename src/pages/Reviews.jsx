import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined';
import { useReviews } from '../hooks/useReviews';
import { useSettings } from '../hooks/useSettings';
import { deleteReview, markReviewsAsExported } from '../firebase/reviewService';
import ReviewCard from '../components/ReviewCard';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingScreen from '../components/LoadingScreen';
import EmptyState from '../components/EmptyState';
import { exportToJudgeMe } from '../utils/exportJudgeMe';

const SOURCES = ['all', 'manual', 'token', 'import', 'google', 'other'];

export default function Reviews() {
  const { reviews, loading } = useReviews();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [productSearch, setProductSearch] = useState('');
  const [keyword, setKeyword] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [exportLang, setExportLang] = useState(settings.judgeMeLanguage || 'en');

  const toggleSelect = (id) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const clearSelection = () => setSelectedIds(new Set());

  if (loading) return <LoadingScreen />;

  const filtered = reviews.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (sourceFilter !== 'all' && r.source !== sourceFilter) return false;
    if (productSearch && !r.productHandle?.toLowerCase().includes(productSearch.toLowerCase())) return false;
    if (keyword) {
      const q = keyword.toLowerCase();
      const match =
        r.reviewerName?.toLowerCase().includes(q) ||
        r.reviewerEmail?.toLowerCase().includes(q) ||
        r.body?.toLowerCase().includes(q) ||
        r.cleanedTextJa?.toLowerCase().includes(q) ||
        r.title?.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const handleDelete = async () => {
    if (deleteTarget) {
      await deleteReview(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  const selectAll = () => setSelectedIds(new Set(filtered.map((r) => r.id)));

  return (
    <Box>
      {/* Page header */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 3 }}
      >
        <Typography variant="h5" fontWeight={700}>
          Reviews
          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            ({filtered.length} / {reviews.length})
          </Typography>
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/reviews/new')}
          >
            Add Review
          </Button>
        </Stack>
      </Stack>

      {/* Filters */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap" sx={{ mb: 3 }}>
        <TextField
          placeholder="Keyword search..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          size="small"
          sx={{ minWidth: 180 }}
        />
        <TextField
          placeholder="Product handle..."
          value={productSearch}
          onChange={(e) => setProductSearch(e.target.value)}
          size="small"
          sx={{ minWidth: 160 }}
        />
        <TextField
          select
          label="Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          size="small"
          sx={{ minWidth: 130 }}
        >
          <MenuItem value="all">All Status</MenuItem>
          <MenuItem value="published">Published</MenuItem>
          <MenuItem value="ready">Ready</MenuItem>
          <MenuItem value="pending">Pending</MenuItem>
          <MenuItem value="rejected">Rejected</MenuItem>
        </TextField>
        <TextField
          select
          label="Source"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          size="small"
          sx={{ minWidth: 130 }}
        >
          {SOURCES.map((s) => (
            <MenuItem key={s} value={s}>{s === 'all' ? 'All Sources' : s}</MenuItem>
          ))}
        </TextField>
      </Stack>

      {/* Export toolbar */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <TextField
          select
          label="Language"
          value={exportLang}
          onChange={(e) => setExportLang(e.target.value)}
          size="small"
          sx={{ minWidth: 100 }}
        >
          <MenuItem value="en">EN</MenuItem>
          <MenuItem value="ja">JA</MenuItem>
        </TextField>
        <Button
          variant="outlined"
          startIcon={<FileDownloadOutlined />}
          onClick={() => {
            const toExport =
              selectedIds.size > 0
                ? filtered.filter((r) => selectedIds.has(r.id))
                : filtered;
            const ids = exportToJudgeMe(toExport, exportLang);
            if (ids.length) markReviewsAsExported(ids, exportLang);
          }}
        >
          {selectedIds.size > 0
            ? `Export (${selectedIds.size} selected)`
            : `Export All (${filtered.length})`}
        </Button>
        {selectedIds.size > 0 ? (
          <Button size="small" onClick={clearSelection}>Clear selection</Button>
        ) : (
          <Button size="small" onClick={selectAll}>Select all</Button>
        )}
      </Stack>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState message="No reviews match the current filters" />
      ) : (
        <Grid container spacing={2}>
          {filtered.map((review) => (
            <Grid size={{ xs: 12, md: 6, lg: 4 }} key={review.id}>
              <ReviewCard
                review={review}
                selected={selectedIds.has(review.id)}
                onToggle={toggleSelect}
                onEdit={() => navigate(`/reviews/${review.id}/edit`)}
                onDelete={(r) => setDeleteTarget(r)}
              />
            </Grid>
          ))}
        </Grid>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Review"
        message={`Delete review by ${deleteTarget?.reviewerName || 'this reviewer'}? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
