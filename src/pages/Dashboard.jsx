import { Box, Card, CardContent, Grid, Typography } from '@mui/material';
import { useReviews } from '../hooks/useReviews';
import LoadingScreen from '../components/LoadingScreen';

function StatCard({ label, value, color = 'text.primary' }) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h3" fontWeight={700} color={color}>
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {label}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { reviews, loading } = useReviews();

  if (loading) return <LoadingScreen />;

  const stats = [
    {
      label: 'Total Reviews',
      value: reviews.length,
    },
    {
      label: 'Ready for Export',
      value: reviews.filter((r) => r.status === 'ready').length,
      color: 'success.main',
    },
    {
      label: 'Exported Reviews',
      value: reviews.filter((r) => r.exportedToJudgeMe === true).length,
      color: 'primary.main',
    },
    {
      label: 'Brand Testimonials',
      value: reviews.filter((r) => r.isBrandTestimonial === true).length,
    },
    {
      label: 'Postcard Reviews',
      value: reviews.filter((r) => !!r.postcardImageUrl).length,
    },
    {
      label: 'Pending OCR Check',
      value: reviews.filter((r) => r.status === 'pending').length,
      color: 'warning.main',
    },
  ];

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Dashboard
      </Typography>

      <Grid container spacing={2}>
        {stats.map((s) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={s.label}>
            <StatCard label={s.label} value={s.value} color={s.color} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
