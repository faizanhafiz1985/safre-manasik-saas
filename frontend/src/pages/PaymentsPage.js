import React, { useEffect, useState } from 'react';
import { Box, Typography, Card, Table, TableBody, TableCell, TableHead, TableRow, CircularProgress, Chip, Tooltip, IconButton } from '@mui/material';
import { Visibility, Download } from '@mui/icons-material';
import api from '../services/api';
import { toast } from 'react-toastify';
import { fmtCurrency, fmtDate } from '../utils/helpers';

const methodColor = { CASH: 'default', BANK_TRANSFER: 'primary', CREDIT_CARD: 'success', CHEQUE: 'warning' };

const fetchBlob = async (url) => {
  const res = await api.get(url, { responseType: 'blob' });
  return { blob: res.data, contentType: res.headers['content-type'] || '' };
};

const previewReceipt = async (paymentId) => {
  try {
    const { blob } = await fetchBlob(`/payments/${paymentId}/receipt/preview`);
    const url = URL.createObjectURL(new Blob([blob], { type: 'text/html' }));
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } catch {
    toast.error('Preview failed. Please try again.');
  }
};

const downloadReceipt = async (paymentId) => {
  try {
    const { blob, contentType } = await fetchBlob(`/payments/${paymentId}/receipt/download`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${paymentId}.${contentType.includes('pdf') ? 'pdf' : 'html'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    toast.error('Download failed. Please try again.');
  }
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});

  useEffect(() => {
    api.get('/payments')
      .then((r) => setPayments(r.data || []))
      .catch((err) => toast.error(err.response?.data?.error || 'Failed to load payments'))
      .finally(() => setLoading(false));
  }, []);

  const withLoading = async (key, fn) => {
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    try { await fn(); } finally { setActionLoading((prev) => ({ ...prev, [key]: false })); }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Payments</Typography>
      <Card>
        {loading ? <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box> : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Booking Ref</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Method</TableCell>
                <TableCell>Reference</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Receipt</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell>{fmtDate(p.paidAt)}</TableCell>
                  <TableCell><Typography variant="caption" fontWeight={600}>{p.booking?.bookingRef}</Typography></TableCell>
                  <TableCell>{p.booking?.customer?.name}</TableCell>
                  <TableCell><Typography fontWeight={700} color="success.main">{fmtCurrency(p.amount)}</Typography></TableCell>
                  <TableCell><Chip label={p.method.replace('_', ' ')} color={methodColor[p.method]} size="small" /></TableCell>
                  <TableCell>{p.reference || '-'}</TableCell>
                  <TableCell><Chip label={p.status} color="success" size="small" /></TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="Preview Receipt Voucher">
                        <IconButton
                          size="small" color="primary"
                          disabled={!!actionLoading[`prev-${p.id}`]}
                          onClick={() => withLoading(`prev-${p.id}`, () => previewReceipt(p.id))}
                        >
                          <Visibility fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Download Receipt Voucher">
                        <IconButton
                          size="small" color="success"
                          disabled={!!actionLoading[`dl-${p.id}`]}
                          onClick={() => withLoading(`dl-${p.id}`, () => downloadReceipt(p.id))}
                        >
                          <Download fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
              {payments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>No payments recorded</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </Box>
  );
}
