import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Card, CardContent, Typography, CircularProgress, Alert, Button } from '@mui/material';
import { CheckCircle, Error as ErrorIcon } from '@mui/icons-material';
import api from '../services/api';

export default function PayPalSuccessPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: null, payment: null });

  // PayPal returns ?token=<orderId>&PayerID=<id>&bookingId=<id>
  const orderId = params.get('token');
  const bookingId = params.get('bookingId');

  useEffect(() => {
    if (!orderId || !bookingId) {
      setState({ loading: false, error: 'Missing order or booking reference', payment: null });
      return;
    }
    (async () => {
      try {
        const { data } = await api.post('/payments/gateway/paypal/capture-order', { orderId, bookingId });
        setState({ loading: false, error: null, payment: data.payment });
        // Auto-redirect to the booking after 3 seconds
        setTimeout(() => navigate(`/bookings/${bookingId}`), 3000);
      } catch (e) {
        setState({ loading: false, error: e.response?.data?.error || 'Capture failed', payment: null });
      }
    })();
  }, [orderId, bookingId, navigate]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F3F8F5', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Card sx={{ maxWidth: 500, width: '100%' }}>
        <Box sx={{ bgcolor: '#0070BA', py: 2, textAlign: 'center' }}>
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>PayPal Payment</Typography>
        </Box>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          {state.loading && (
            <>
              <CircularProgress sx={{ mb: 2 }} />
              <Typography>Capturing your payment...</Typography>
            </>
          )}
          {state.error && (
            <>
              <ErrorIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
              <Alert severity="error" sx={{ mb: 2 }}>{state.error}</Alert>
              <Button variant="contained" onClick={() => navigate(`/bookings/${bookingId}`)}>Back to Booking</Button>
            </>
          )}
          {state.payment && (
            <>
              <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>Payment Successful</Typography>
              <Typography color="text.secondary" sx={{ mb: 1 }}>
                {Number(state.payment.amount).toLocaleString()} {state.payment.currency} received
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Reference: {state.payment.gatewayRef}
              </Typography>
              <Box sx={{ mt: 3 }}>
                <Typography variant="caption" color="text.secondary">Returning to booking in 3 seconds...</Typography>
                <Button sx={{ mt: 2 }} variant="contained" onClick={() => navigate(`/bookings/${bookingId}`)}>Back to Booking now</Button>
              </Box>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
