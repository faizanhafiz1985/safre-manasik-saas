import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Card, CardContent, TextField, InputAdornment, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, CircularProgress, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Grid, Autocomplete } from '@mui/material';
import { Add, Search, Visibility } from '@mui/icons-material';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { useForm } from 'react-hook-form';
import { fmtCurrency, fmtDate, statusChip } from '../utils/helpers';
import { numericOnly, decimalOnly } from '../utils/validation';

export default function BookingsPage() {
  const { isAdmin, isAgent } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [packages, setPackages] = useState([]);
  const [customers, setCustomers] = useState([]);

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm();
  const selectedPkg = watch('packageId');
  const [selectedPkgData, setSelectedPkgData] = useState(null);

  useEffect(() => {
    if (selectedPkg) setSelectedPkgData(packages.find((p) => p.id === selectedPkg));
  }, [selectedPkg, packages]);

  const load = useCallback(() => {
    setLoading(true);
    const params = { page: page + 1, limit: rowsPerPage, ...(search && { search }), ...(statusFilter && { status: statusFilter }) };
    api.get('/bookings', { params }).then((r) => {
      setBookings(r.data.data || []);
      setTotal(r.data.total || 0);
    }).catch((err) => toast.error(err.response?.data?.error || 'Failed to load bookings')).finally(() => setLoading(false));
  }, [page, rowsPerPage, search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (isAdmin || isAgent) {
      api.get('/packages').then((r) => setPackages(r.data.data || [])).catch(() => {});
      api.get('/users/customers').then((r) => setCustomers(r.data.data || [])).catch(() => {});
    }
  }, [isAdmin, isAgent]);

  const openCreate = () => { reset({ totalPax: 1, status: 'TENTATIVE' }); setSelectedPkgData(null); setOpen(true); };

  const onSubmit = async (data) => {
    try {
      const tier = selectedPkgData?.priceTiers?.find((t) => t.id === data.priceTierId);
      const amount = tier ? Number(tier.pricePerPax) * Number(data.totalPax) : data.totalAmount;
      await api.post('/bookings', { ...data, totalAmount: amount, passengers: [] });
      toast.success('Booking created successfully');
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create booking');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Bookings</Typography>
        {(isAdmin || isAgent) && <Button variant="contained" startIcon={<Add />} onClick={openCreate}>New Booking</Button>}
      </Box>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6}>
              <TextField fullWidth placeholder="Search by ref or customer name..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField fullWidth select label="Status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}>
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="TENTATIVE">Tentative</MenuItem>
                <MenuItem value="CONFIRMED">Confirmed</MenuItem>
                <MenuItem value="CANCELLED">Cancelled</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        {loading ? <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box> : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Ref</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell>Package</TableCell>
                    <TableCell>Travel Date</TableCell>
                    <TableCell>Pax</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bookings.map((b) => (
                    <TableRow key={b.id} hover>
                      <TableCell><Typography variant="caption" fontWeight={600}>{b.bookingRef}</Typography></TableCell>
                      <TableCell>{b.customer?.name}</TableCell>
                      <TableCell><Typography variant="caption">{b.package?.name?.substring(0, 25)}{b.package?.name?.length > 25 ? '...' : ''}</Typography></TableCell>
                      <TableCell><Typography variant="caption">{fmtDate(b.travelDateFrom)}</Typography></TableCell>
                      <TableCell>{b.totalPax}</TableCell>
                      <TableCell>{fmtCurrency(b.totalAmount)}</TableCell>
                      <TableCell>{statusChip(b.status)}</TableCell>
                      <TableCell>
                        <Button size="small" startIcon={<Visibility />} onClick={() => navigate(`/bookings/${b.id}`)}>View</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {bookings.length === 0 && <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>No bookings found</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination rowsPerPageOptions={[10]} component="div" count={total} rowsPerPage={rowsPerPage} page={page} onPageChange={(e, p) => setPage(p)} />
          </>
        )}
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Booking</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent dividers>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField fullWidth select label="Customer *" error={!!errors.customerId} {...register('customerId', { required: true })}>
                  {customers.map((c) => <MenuItem key={c.id} value={c.id}>{c.name} ({c.email})</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth select label="Package *" error={!!errors.packageId} {...register('packageId', { required: true })}>
                  {packages.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                </TextField>
              </Grid>
              {selectedPkgData?.priceTiers?.length > 0 && (
                <Grid item xs={12}>
                  <TextField fullWidth select label="Price Tier" {...register('priceTierId')}>
                    {selectedPkgData.priceTiers.map((t) => <MenuItem key={t.id} value={t.id}>{t.tierName} - {fmtCurrency(t.pricePerPax)}/pax</MenuItem>)}
                  </TextField>
                </Grid>
              )}
              <Grid item xs={6}><TextField fullWidth label="Departure Date" type="date" InputLabelProps={{ shrink: true }} {...register('travelDateFrom', { required: true })} /></Grid>
              <Grid item xs={6}><TextField fullWidth label="Return Date" type="date" InputLabelProps={{ shrink: true }} {...register('travelDateTo', { required: true })} /></Grid>
              <Grid item xs={6}><TextField fullWidth label="Total Pax" type="number" inputProps={{ min: 1, onKeyDown: numericOnly }} {...register('totalPax', { min: { value: 1, message: 'Min 1' }, valueAsNumber: true })} /></Grid>
              <Grid item xs={6}><TextField fullWidth label="Total Amount (SAR)" type="number" inputProps={{ min: 0, onKeyDown: decimalOnly }} {...register('totalAmount', { valueAsNumber: true, min: { value: 0, message: 'Must be positive' } })} /></Grid>
              <Grid item xs={12}><TextField fullWidth multiline rows={2} label="Notes" {...register('notes')} /></Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Create Booking</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
