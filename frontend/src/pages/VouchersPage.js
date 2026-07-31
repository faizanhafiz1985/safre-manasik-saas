import React, { useEffect, useState } from 'react';
import { Box, Typography, Card, Table, TableBody, TableCell, TableHead, TableRow, CircularProgress, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, TextField, Tooltip, IconButton } from '@mui/material';
import { ConfirmationNumber, Download, Visibility, Add, Delete } from '@mui/icons-material';
import api from '../services/api';
import { toast } from 'react-toastify';
import { fmtDate } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import { useForm } from 'react-hook-form';

// Fetch voucher HTML/PDF via axios (sends Authorization header automatically)
const fetchVoucherBlob = async (url) => {
  const res = await api.get(url, { responseType: 'blob' });
  return { blob: res.data, contentType: res.headers['content-type'] || '' };
};

const previewVoucher = async (bookingId, type, voucherNo) => {
  try {
    const params = new URLSearchParams({ type });
    if (voucherNo) params.set('voucherNo', voucherNo);
    const { blob } = await fetchVoucherBlob(`/vouchers/preview/${bookingId}?${params}`);
    const url = URL.createObjectURL(new Blob([blob], { type: 'text/html' }));
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } catch {
    toast.error('Preview failed. Please try again.');
  }
};

const downloadVoucher = async (voucherId, voucherNo, type) => {
  try {
    const { blob, contentType } = await fetchVoucherBlob(`/vouchers/download/${voucherId}`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const typeLabel = type === 'CONFIRMED' ? 'confirmed-voucher' : 'tentative-voucher';
    const ref = voucherNo || voucherId;
    a.download = `${typeLabel}-${ref}.${contentType.includes('pdf') ? 'pdf' : 'html'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    toast.error('Download failed. Please try again.');
  }
};

export default function VouchersPage() {
  const { isAdmin, isAgent } = useAuth();
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [defaultType, setDefaultType] = useState('CONFIRMED');
  const [bookings, setBookings] = useState([]);
  const [actionLoading, setActionLoading] = useState({});
  const { register, handleSubmit, reset } = useForm({ defaultValues: { type: 'CONFIRMED' } });

  const load = () => {
    setLoading(true);
    api.get('/vouchers').then((r) => setVouchers(r.data || [])).catch((err) => toast.error(err.response?.data?.error || 'Failed to load vouchers')).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    if (isAdmin || isAgent) {
      api.get('/bookings', { params: { limit: 100 } }).then((r) => setBookings(r.data.data || [])).catch(()=>{});
    }
  }, [isAdmin, isAgent]);

  const openDialog = (type) => {
    setDefaultType(type);
    reset({ type });
    setOpen(true);
  };

  const onGenerate = async (data) => {
    try {
      await api.post('/vouchers/generate', data);
      toast.success(`${data.type === 'CONFIRMED' ? 'Confirmed' : 'Tentative'} voucher generated`);
      setOpen(false);
      reset();
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate voucher');
    }
  };

  // Admin-only. Confirmed vouchers are final documents — the server rejects them.
  const onDelete = async (v) => {
    if (!window.confirm(`Delete tentative voucher ${v.voucherNo || ''}?\n\nThis removes the voucher record only — the booking ${v.booking?.bookingRef || ''} is not affected.`)) return;
    try {
      await api.delete(`/vouchers/${v.id}`);
      toast.success(`Voucher ${v.voucherNo || ''} deleted`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete voucher');
    }
  };

  const withLoading = async (key, fn) => {
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    try { await fn(); } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const typeChipProps = {
    CONFIRMED: { color: 'success', label: 'Confirmed' },
    TENTATIVE: { color: 'warning', label: 'Tentative' },
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="#1B4B35">Vouchers</Typography>
          <Typography variant="body2" color="text.secondary">Generate and manage travel vouchers</Typography>
        </Box>
        {(isAdmin || isAgent) && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined" startIcon={<Add />}
              onClick={() => openDialog('TENTATIVE')}
              sx={{ borderColor: '#C9A227', color: '#C9A227', '&:hover': { bgcolor: '#FFF8E6', borderColor: '#C9A227' } }}
            >
              Tentative Voucher
            </Button>
            <Button variant="contained" startIcon={<Add />} onClick={() => openDialog('CONFIRMED')}>
              Confirmed Voucher
            </Button>
          </Box>
        )}
      </Box>

      <Card>
        {loading ? <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box> : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Voucher No</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Booking Ref</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Package</TableCell>
                <TableCell>Generated</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {vouchers.map((v) => {
                const chip = typeChipProps[v.type] || { color: 'default', label: v.type };
                const previewKey = `preview-${v.id}`;
                const dlKey = `dl-${v.id}`;
                return (
                  <TableRow key={v.id} hover>
                    <TableCell>
                      <Typography variant="caption" fontWeight={700} sx={{ color: '#1B4B35' }}>
                        {v.voucherNo || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ConfirmationNumber fontSize="small" sx={{ color: v.type === 'CONFIRMED' ? '#16a34a' : '#C9A227' }} />
                        <Chip label={chip.label} color={chip.color} size="small" />
                      </Box>
                    </TableCell>
                    <TableCell><Typography variant="caption" fontWeight={600}>{v.booking?.bookingRef}</Typography></TableCell>
                    <TableCell>{v.booking?.customer?.name}</TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {(v.booking?.package?.name || '').substring(0, 28)}
                        {(v.booking?.package?.name || '').length > 28 ? '…' : ''}
                      </Typography>
                    </TableCell>
                    <TableCell>{fmtDate(v.generatedAt)}</TableCell>
                    <TableCell><Chip label={v.isValid ? 'Valid' : 'Void'} color={v.isValid ? 'success' : 'error'} size="small" /></TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Button
                          size="small" startIcon={actionLoading[previewKey] ? <CircularProgress size={12} /> : <Visibility />}
                          disabled={actionLoading[previewKey]}
                          onClick={() => withLoading(previewKey, () => previewVoucher(v.booking?.id, v.type, v.voucherNo))}
                          sx={{ color: '#1B4B35' }}
                        >
                          Preview
                        </Button>
                        <Button
                          size="small" startIcon={actionLoading[dlKey] ? <CircularProgress size={12} /> : <Download />}
                          disabled={actionLoading[dlKey]}
                          onClick={() => withLoading(dlKey, () => downloadVoucher(v.id, v.voucherNo, v.type))}
                          color="primary"
                        >
                          PDF
                        </Button>
                        {isAdmin && v.type === 'TENTATIVE' && (
                          <Tooltip title="Delete tentative voucher">
                            <IconButton size="small" color="error" onClick={() => onDelete(v)}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
              {vouchers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    <ConfirmationNumber sx={{ fontSize: 40, color: '#e2e8f0', mb: 1, display: 'block', mx: 'auto' }} />
                    No vouchers generated yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: defaultType === 'CONFIRMED' ? '#1B4B35' : '#C9A227' }}>
          Generate {defaultType === 'CONFIRMED' ? 'Confirmed' : 'Tentative'} Voucher
        </DialogTitle>
        <form onSubmit={handleSubmit(onGenerate)}>
          <DialogContent sx={{ pt: 3 }}>
            <TextField fullWidth select label="Select Booking" {...register('bookingId', { required: true })} sx={{ mb: 2 }}>
              {bookings.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.bookingRef} — {b.customer?.name} ({b.status})
                </MenuItem>
              ))}
            </TextField>
            <TextField fullWidth select label="Voucher Type" defaultValue={defaultType} {...register('type')}>
              <MenuItem value="TENTATIVE">Tentative Voucher</MenuItem>
              <MenuItem value="CONFIRMED">Confirmed Voucher</MenuItem>
            </TextField>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Generate</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
