import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Card, CardContent, Typography, Button, Alert, Stack } from '@mui/material';
import { CreditCard, CheckCircle } from '@mui/icons-material';
import { toast } from 'react-toastify';
import api from '../services/api';

export default function PaymentStubPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const intent = params.get('intent');
  const bookingId = params.get('bookingId');
  const amount = params.get('amount');
  const currency = params.get('currency') || 'SAR';
  const [paying, setPaying] = React.useState(false);

  const confirm = async () => {
    setPaying(true);
    try {
      await api.post('/payments/gateway/webhook', {
        intentId: intent, bookingId, amount, status: 'paid', gatewayRef: `stub-${intent}`,
      });
      toast.success('Payment confirmed!');
      navigate(`/bookings/${bookingId}`);
    } finally {
      setPaying(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F3F8F5', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Card sx={{ maxWidth: 500, width: '100%' }}>
        <Box sx={{ bgcolor: '#1B4B35', py: 2, textAlign: 'center' }}>
          <Typography variant="h6" sx={{ color: '#fff' }}>Moyasar Payment Gateway</Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>STUB MODE — for testing</Typography>
        </Box>
        <CardContent sx={{ p: 4 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            This is a sandbox payment page. In production, this would be the real Moyasar checkout.
          </Alert>
          <Stack spacing={2}>
            <Box>
              <Typography variant="caption" color="text.secondary">Amount</Typography>
              <Typography variant="h4" fontWeight={700}>{Number(amount).toLocaleString()} {currency}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Booking</Typography>
              <Typography><code>{bookingId}</code></Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Payment Intent</Typography>
              <Typography><code>{intent}</code></Typography>
            </Box>
          </Stack>
          <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
            <Button fullWidth variant="outlined" onClick={() => navigate(-1)}>Cancel</Button>
            <Button fullWidth variant="contained" startIcon={<CheckCircle />} onClick={confirm} disabled={paying}>
              {paying ? 'Processing...' : 'Confirm Payment'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
