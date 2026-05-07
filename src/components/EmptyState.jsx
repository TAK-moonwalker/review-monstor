import { Box, Typography } from '@mui/material';
import InboxOutlined from '@mui/icons-material/InboxOutlined';

export default function EmptyState({ message = 'No data found' }) {
  return (
    <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
      <InboxOutlined sx={{ fontSize: 64, mb: 2 }} />
      <Typography variant="h6">{message}</Typography>
    </Box>
  );
}
