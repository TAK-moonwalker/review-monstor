import {
  Box,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Checkbox,
  Chip,
  IconButton,
  Rating,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import EditOutlined from '@mui/icons-material/EditOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import PhotoCamera from '@mui/icons-material/PhotoCamera';
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined';
import VerifiedOutlined from '@mui/icons-material/VerifiedOutlined';
import CheckCircleOutlineOutlined from '@mui/icons-material/CheckCircleOutlineOutlined';
import ReviewStatusChip from './ReviewStatusChip';
import SnsCardGeneratorDialog from './SnsCardGeneratorDialog';
import { formatDate } from '../utils/dateUtils';
import { useState } from 'react';

function toDate(v) {
  if (!v) return null;
  return typeof v.toDate === 'function' ? v.toDate() : new Date(v);
}

export default function ReviewCard({ review, onEdit, onDelete, selected = false, onToggle }) {
  const [snsDialogOpen, setSnsDialogOpen] = useState(false);
  const displayTitle = review.titleJa || review.titleEn || review.title || '';
  const displayText = review.bodyJa || review.bodyEn || review.body || review.cleanedTextJa || '';

  const updatedAt = toDate(review.updatedAt);
  const exportedEn = toDate(review.exportedToJudgeMeEn);
  const exportedJa = toDate(review.exportedToJudgeMeJa);
  const enStale = exportedEn && updatedAt && updatedAt > exportedEn;
  const jaStale = exportedJa && updatedAt && updatedAt > exportedJa;

  return (
    <Card
      variant="outlined"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        borderColor: selected ? 'primary.main' : 'divider',
        borderWidth: selected ? 2 : 1,
      }}
    >
      {review.postcardImageUrl && (
        <CardMedia
          component="img"
          height={120}
          image={review.postcardImageUrl}
          alt="Postcard"
          sx={{ objectFit: 'cover' }}
        />
      )}

      <CardContent sx={{ flexGrow: 1 }}>
        {/* Header row: checkbox + name + status */}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Checkbox
            checked={selected}
            onChange={() => onToggle?.(review.id)}
            size="small"
            sx={{ mt: -0.5, ml: -1, flexShrink: 0 }}
          />
          <Box minWidth={0} flex={1}>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="subtitle1" fontWeight={600} noWrap>
                {review.reviewerName || '(No name)'}
              </Typography>
              {review.verified && (
                <Tooltip title="Verified Purchase">
                  <VerifiedOutlined fontSize="small" color="primary" />
                </Tooltip>
              )}
              {review.permissionGranted && (
                <Tooltip title="Permission Granted">
                  <CheckCircleOutlineOutlined fontSize="small" color="success" />
                </Tooltip>
              )}
            </Stack>
            {review.reviewerEmail && (
              <Typography variant="caption" color="text.secondary" noWrap display="block">
                {review.reviewerEmail}
              </Typography>
            )}
          </Box>
          <ReviewStatusChip status={review.status} />
        </Stack>

        {/* Rating */}
        <Rating value={Number(review.rating) || 0} readOnly size="small" sx={{ mt: 0.5 }} />

        {/* Title */}
        {displayTitle && (
          <Typography variant="body2" fontWeight={600} sx={{ mt: 0.75 }}>
            {displayTitle}
          </Typography>
        )}

        {/* Body */}
        {displayText && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mt: 0.5,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {displayText}
          </Typography>
        )}

        {/* Meta row: product + source + date */}
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1.5 }} alignItems="center">
          {review.productHandle && (
            <Chip
              label={review.productHandle}
              size="small"
              variant="outlined"
              sx={{ maxWidth: 160 }}
            />
          )}
          {review.source && (
            <Chip label={review.source} size="small" color="default" />
          )}
          {exportedEn && (
            <Tooltip title={`EN exported ${formatDate(review.exportedToJudgeMeEn)}${enStale ? ' — edited after export' : ''}`}>
              <Chip
                icon={<FileDownloadOutlined />}
                label="EN"
                size="small"
                color={enStale ? 'warning' : 'success'}
                variant="outlined"
              />
            </Tooltip>
          )}
          {exportedJa && (
            <Tooltip title={`JA exported ${formatDate(review.exportedToJudgeMeJa)}${jaStale ? ' — edited after export' : ''}`}>
              <Chip
                icon={<FileDownloadOutlined />}
                label="JA"
                size="small"
                color={jaStale ? 'warning' : 'success'}
                variant="outlined"
              />
            </Tooltip>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            {formatDate(review.createdAt)}
          </Typography>
        </Stack>
      </CardContent>

      <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
        <Tooltip title="Generate SNS Card">
          <IconButton size="small" onClick={() => setSnsDialogOpen(true)} aria-label="generate sns card">
            <PhotoCamera fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Edit">
          <IconButton size="small" onClick={() => onEdit(review)} aria-label="edit">
            <EditOutlined fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton
            size="small"
            onClick={() => onDelete(review)}
            aria-label="delete"
            color="error"
          >
            <DeleteOutlined fontSize="small" />
          </IconButton>
        </Tooltip>
      </CardActions>

      <SnsCardGeneratorDialog
        open={snsDialogOpen}
        onClose={() => setSnsDialogOpen(false)}
        review={review}
      />
    </Card>
  );
}

