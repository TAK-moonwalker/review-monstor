import { Chip } from '@mui/material';

const STATUS_CONFIG = {
  published: { label: 'Published', color: 'success' },
  ready: { label: 'Ready', color: 'info' },
  pending: { label: 'Pending', color: 'warning' },
  rejected: { label: 'Rejected', color: 'error' },
};

export default function ReviewStatusChip({ status }) {
  const config = STATUS_CONFIG[status] ?? { label: status, color: 'default' };
  return <Chip label={config.label} color={config.color} size="small" />;
}
