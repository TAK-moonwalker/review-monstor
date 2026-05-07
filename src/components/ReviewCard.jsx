import {
  Box,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Chip,
  IconButton,
  Rating,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import EditOutlined from '@mui/icons-material/EditOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import VerifiedOutlined from '@mui/icons-material/VerifiedOutlined';
import CheckCircleOutlineOutlined from '@mui/icons-material/CheckCircleOutlineOutlined';
import ReviewStatusChip from './ReviewStatusChip';
import { formatDate } from '../utils/dateUtils';

export default function ReviewCard({ review, onEdit, onDelete }) {
  const displayText = review.body || review.cleanedTextJa || '';

  return (
    <Card variant="outlined" sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
        {/* Header row: name + status */}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box minWidth={0}>
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
        {review.title && (
          <Typography variant="body2" fontWeight={600} sx={{ mt: 0.75 }}>
            {review.title}
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
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            {formatDate(review.createdAt)}
          </Typography>
        </Stack>
      </CardContent>

      <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
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
    </Card>
  );
}

