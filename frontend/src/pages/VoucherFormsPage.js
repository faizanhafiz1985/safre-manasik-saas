import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Button, Card, Table, TableBody, TableCell, TableHead, TableRow,
  CircularProgress, Chip, TextField, InputAdornment, MenuItem, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, TablePagination, IconButton, Tooltip,
  ToggleButton, ToggleButtonGroup, Alert, Divider, InputLabel, FormControl, Select,
} from '@mui/material';
import {
  Add, Search, Receipt, Delete, CheckCircle, Hotel as HotelIcon, DirectionsBus,
  RestartAlt, Print,
} from '@mui/icons-material';
import api from '../services/api';
import { toast } from 'react-toastify';
import { fmtDate } from '../utils/helpers';
import { PATTERNS, numericOnly, alphaOnly } from '../utils/validation';

const SAR = (n) => `SAR ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
const D12 = /^\d{12}$/;
const ALPHANUM = /^[A-Za-z0-9]+$/;
const VEHICLE_TYPES = ['Sedan', 'SUV (GMC)', 'Van (Hiace)', 'Coaster', 'Bus (50-seater)', 'VIP'];

const EMPTY_TRIP = { hotelId: '', hotelName: '', checkInDate: '', checkOutDate: '', perNightPrice: '' };
const EMPTY = {
  type: 'HOTEL',
  companyName: '', firstName: '', lastName: '', mobile: '', whatsapp: '', passport: '',
  trips: [{ ...EMPTY_TRIP }],
  vehicleType: '', pickupLocation: '', dropoffLocation: '', travelDate: '', passengerCount: '', transportPrice: '',
};

// nights between two yyyy-mm-dd strings (UTC, matches the backend)
function nights(ci, co) {
  if (!ci || !co) return 0;
  const a = new Date(ci); const b = new Date(co);
  const d = Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
  return d > 0 ? d : 0;
}

export default function VoucherFormsPage() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errs, setErrs] = useState({});
  const [voucherNo, setVoucherNo] = useState('—');
  const [hotels, setHotels] = useState([]);
  const [saving, setSaving] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const [hcnDialog, setHcnDialog] = useState(null); // voucher being confirmed
  const [hcn, setHcn] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/voucher-forms', { params: { page: page + 1, limit: 15, ...(search && { search }), ...(statusFilter && { status: statusFilter }) } })
      .then((r) => { setRows(r.data.data || []); setTotal(r.data.total || 0); })
      .catch((e) => toast.error(e.response?.data?.error || 'Failed to load vouchers'))
      .finally(() => setLoading(false));
  }, [page, search, statusFilter]);
  useEffect(() => { load(); }, [load]);

  const openNew = async () => {
    setForm(EMPTY); setErrs({}); setVoucherNo('…'); setOpen(true);
    try {
      const [n, h] = await Promise.all([
        api.get('/voucher-forms/next-number'),
        api.get('/hotels').catch(() => ({ data: [] })),
      ]);
      setVoucherNo(n.data.voucherNo);
      setHotels(Array.isArray(h.data) ? h.data : (h.data.data || []));
    } catch { setVoucherNo('(auto)'); }
  };

  const isHotel = form.type === 'HOTEL';
  const tripTotal = (t) => nights(t.checkInDate, t.checkOutDate) * Number(t.perNightPrice || 0);
  const liveTotal = isHotel ? (form.trips || []).reduce((s, t) => s + tripTotal(t), 0) : Number(form.transportPrice || 0);

  const updateTrip = (idx, patch) => setForm((f) => ({ ...f, trips: f.trips.map((t, i) => i === idx ? { ...t, ...patch } : t) }));
  const addTrip = () => setForm((f) => ({ ...f, trips: [...f.trips, { ...EMPTY_TRIP }] }));
  const removeTrip = (idx) => setForm((f) => ({ ...f, trips: f.trips.length > 1 ? f.trips.filter((_, i) => i !== idx) : f.trips }));

  const onHotelSelect = (idx, hotelId) => {
    const h = hotels.find((x) => x.id === hotelId);
    updateTrip(idx, {
      hotelId,
      hotelName: h?.name || '',
      perNightPrice: h?.pricePerNight != null ? String(h.pricePerNight) : form.trips[idx].perNightPrice,
    });
  };

  function validate() {
    const e = {};
    if (!form.firstName || !PATTERNS.ALPHA_ONLY.test(form.firstName.trim())) e.firstName = 'Letters only, required';
    if (!form.lastName || !PATTERNS.ALPHA_ONLY.test(form.lastName.trim())) e.lastName = 'Letters only, required';
    if (form.companyName && !PATTERNS.ALPHA_ONLY.test(form.companyName.trim())) e.companyName = 'Letters only';
    if (!D12.test((form.mobile || '').replace(/\s/g, ''))) e.mobile = 'Exactly 12 digits';
    if (form.whatsapp && !D12.test((form.whatsapp || '').replace(/\s/g, ''))) e.whatsapp = 'Exactly 12 digits';
    if (!form.passport || !ALPHANUM.test(form.passport.trim())) e.passport = 'Alphanumeric, required';
    if (isHotel) {
      e.trips = (form.trips || []).map((t) => {
        const te = {};
        if (!t.hotelName) te.hotelName = 'Select a hotel';
        if (!t.checkInDate) te.checkInDate = 'Required';
        if (!t.checkOutDate) te.checkOutDate = 'Required';
        if (t.checkInDate && t.checkOutDate && nights(t.checkInDate, t.checkOutDate) <= 0) te.checkOutDate = 'After check-in';
        if (t.perNightPrice === '' || isNaN(Number(t.perNightPrice))) te.perNightPrice = 'Required';
        return te;
      });
      if (e.trips.every((te) => Object.keys(te).length === 0)) delete e.trips;
    } else {
      if (!form.vehicleType) e.vehicleType = 'Required';
      if (!form.pickupLocation) e.pickupLocation = 'Required';
      if (!form.dropoffLocation) e.dropoffLocation = 'Required';
      if (!form.travelDate) e.travelDate = 'Required';
      if (form.transportPrice === '' || isNaN(Number(form.transportPrice))) e.transportPrice = 'Required numeric';
    }
    setErrs(e);
    return Object.keys(e).length === 0;
  }

  const doSubmit = async () => {
    setSaving(true);
    try {
      await api.post('/voucher-forms', form);
      toast.success('Voucher created (Tentative)');
      setConfirmSubmit(false); setOpen(false); load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to create voucher');
    } finally { setSaving(false); }
  };

  const handleReset = () => {
    if (window.confirm('Reset the form? All entered data will be cleared.')) { setForm({ ...EMPTY, type: form.type }); setErrs({}); }
  };

  const confirmVoucher = async () => {
    if (!ALPHANUM.test((hcn || '').trim())) return toast.error('HCN # must be alphanumeric');
    try {
      await api.patch(`/voucher-forms/${hcnDialog.id}/confirm`, { hcn: hcn.trim() });
      toast.success('Voucher confirmed');
      setHcnDialog(null); setHcn(''); load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to confirm'); }
  };

  const printVoucher = async (v) => {
    try {
      const r = await api.get(`/voucher-forms/${v.id}/print`, { responseType: 'text' });
      const w = window.open('', '_blank');
      if (!w) return toast.error('Pop-up blocked — allow pop-ups to print');
      w.document.write(r.data); w.document.close();
    } catch { toast.error('Failed to load voucher'); }
  };

  const del = async (v) => {
    if (!window.confirm(`Delete voucher ${v.voucherNo}?`)) return;
    try { await api.delete(`/voucher-forms/${v.id}`); toast.success('Deleted'); load(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed to delete'); }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5">Direct Vouchers</Typography>
          <Typography variant="body2" color="text.secondary">Standalone hotel & transport vouchers</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={openNew}>New Voucher</Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField placeholder="Search voucher #, name, mobile, hotel, HCN…" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }} sx={{ flex: 1, minWidth: 240 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} />
        <TextField select label="Status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }} sx={{ width: 180 }}>
          <MenuItem value="">All</MenuItem>
          <MenuItem value="TENTATIVE">Tentative</MenuItem>
          <MenuItem value="CONFIRMED">Confirmed</MenuItem>
        </TextField>
      </Box>

      <Card>
        {loading ? <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box> : (
          <>
            <Box sx={{ overflowX: 'auto' }}>
              <Table>
                <TableHead><TableRow>
                  <TableCell>Voucher #</TableCell><TableCell>Type</TableCell><TableCell>Customer</TableCell>
                  <TableCell>Status</TableCell><TableCell>HCN #</TableCell><TableCell align="right">Total</TableCell>
                  <TableCell>Created</TableCell><TableCell align="right">Actions</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {rows.map((v) => (
                    <TableRow key={v.id} hover>
                      <TableCell sx={{ fontWeight: 700, fontFamily: 'monospace' }}>{v.voucherNo}</TableCell>
                      <TableCell><Chip size="small" icon={v.type === 'HOTEL' ? <HotelIcon fontSize="small" /> : <DirectionsBus fontSize="small" />} label={v.type} /></TableCell>
                      <TableCell>{v.firstName} {v.lastName}</TableCell>
                      <TableCell><Chip size="small" label={v.status} color={v.status === 'CONFIRMED' ? 'success' : 'warning'} /></TableCell>
                      <TableCell>{v.hcn || '—'}</TableCell>
                      <TableCell align="right">{SAR(v.totalValue)}</TableCell>
                      <TableCell><Typography variant="caption">{fmtDate(v.createdAt)}</Typography></TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                          {v.status === 'TENTATIVE' && (
                            <Tooltip title="Convert to Confirmed"><IconButton size="small" color="success" onClick={() => { setHcnDialog(v); setHcn(''); }}><CheckCircle fontSize="small" /></IconButton></Tooltip>
                          )}
                          <Tooltip title="Print"><IconButton size="small" color="primary" onClick={() => printVoucher(v)}><Receipt fontSize="small" /></IconButton></Tooltip>
                          <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => del(v)}><Delete fontSize="small" /></IconButton></Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>No vouchers yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </Box>
            <TablePagination rowsPerPageOptions={[15]} component="div" count={total} rowsPerPage={15} page={page} onPageChange={(_, p) => setPage(p)} />
          </>
        )}
      </Card>

      {/* New Voucher dialog */}
      <Dialog open={open} onClose={() => !saving && setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#1B4B35' }}>New Voucher</DialogTitle>
        <DialogContent dividers>
          {/* Prominent TENTATIVE banner + voucher number */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, p: 1.5, borderRadius: 2, bgcolor: '#FFF8E7', border: '1px solid #F0D9A8' }}>
            <Chip label="TENTATIVE" color="warning" sx={{ fontWeight: 800, letterSpacing: 1 }} />
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" color="text.secondary">Voucher Number</Typography>
              <Typography variant="h6" sx={{ fontFamily: 'monospace', color: '#1B4B35', fontWeight: 700 }}>{voucherNo}</Typography>
            </Box>
          </Box>

          <ToggleButtonGroup exclusive size="small" color="primary" value={form.type}
            onChange={(_, v) => v && setForm({ ...EMPTY, type: v })} sx={{ mb: 2 }}>
            <ToggleButton value="HOTEL" sx={{ px: 3 }}><HotelIcon fontSize="small" sx={{ mr: 1 }} /> Hotel Voucher</ToggleButton>
            <ToggleButton value="TRANSPORT" sx={{ px: 3 }}><DirectionsBus fontSize="small" sx={{ mr: 1 }} /> Transport Voucher</ToggleButton>
          </ToggleButtonGroup>

          {/* Common party fields */}
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: '#1B4B35' }}>Customer</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Company Name (optional)" error={!!errs.companyName} helperText={errs.companyName}
              inputProps={{ onKeyDown: alphaOnly }} value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Passport # *" error={!!errs.passport} helperText={errs.passport}
              value={form.passport} onChange={(e) => setForm({ ...form, passport: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="First Name *" error={!!errs.firstName} helperText={errs.firstName}
              inputProps={{ onKeyDown: alphaOnly }} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Last Name *" error={!!errs.lastName} helperText={errs.lastName}
              inputProps={{ onKeyDown: alphaOnly }} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Mobile # *" error={!!errs.mobile} helperText={errs.mobile || 'e.g. 966501234567 (12 digits)'}
              inputProps={{ onKeyDown: numericOnly, maxLength: 12 }} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="WhatsApp # (optional)" error={!!errs.whatsapp} helperText={errs.whatsapp || '12 digits if provided'}
              inputProps={{ onKeyDown: numericOnly, maxLength: 12 }} value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />

          {isHotel ? (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#1B4B35' }}>Trips ({form.trips.length})</Typography>
                <Button size="small" startIcon={<Add />} variant="outlined" onClick={addTrip}>Add Trip</Button>
              </Box>
              {form.trips.map((t, i) => {
                const te = errs.trips?.[i] || {};
                return (
                  <Card key={i} variant="outlined" sx={{ p: 2, mb: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Chip size="small" label={`Trip ${i + 1}`} />
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Subtotal: {SAR(tripTotal(t))} ({nights(t.checkInDate, t.checkOutDate)} nights)
                        </Typography>
                        {form.trips.length > 1 && <IconButton size="small" color="error" onClick={() => removeTrip(i)}><Delete fontSize="small" /></IconButton>}
                      </Box>
                    </Box>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth size="small" error={!!te.hotelName}>
                          <InputLabel>Hotel Name *</InputLabel>
                          <Select label="Hotel Name *" value={t.hotelId} onChange={(e) => onHotelSelect(i, e.target.value)}>
                            {hotels.length === 0 && <MenuItem value="" disabled>No hotels found — add hotels first</MenuItem>}
                            {hotels.map((h) => <MenuItem key={h.id} value={h.id}>{h.name}{h.city ? ` — ${h.city}` : ''}</MenuItem>)}
                          </Select>
                        </FormControl>
                        {te.hotelName && <Typography variant="caption" color="error">{te.hotelName}</Typography>}
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField fullWidth size="small" label="Per Night Selling Price *" error={!!te.perNightPrice}
                          helperText={te.perNightPrice || (t.hotelId && !t.perNightPrice ? 'No preset price — enter manually' : 'Auto-filled from hotel')}
                          InputProps={{ startAdornment: <InputAdornment position="start">SAR</InputAdornment> }}
                          inputProps={{ onKeyDown: numericOnly }}
                          value={t.perNightPrice} onChange={(e) => updateTrip(i, { perNightPrice: e.target.value })} />
                      </Grid>
                      <Grid item xs={12} sm={6}><TextField fullWidth size="small" type="date" label="Check-in Date *" InputLabelProps={{ shrink: true }}
                        error={!!te.checkInDate} helperText={te.checkInDate} value={t.checkInDate} onChange={(e) => updateTrip(i, { checkInDate: e.target.value })} /></Grid>
                      <Grid item xs={12} sm={6}><TextField fullWidth size="small" type="date" label="Check-out Date *" InputLabelProps={{ shrink: true }}
                        inputProps={{ min: t.checkInDate || undefined }}
                        error={!!te.checkOutDate} helperText={te.checkOutDate} value={t.checkOutDate} onChange={(e) => updateTrip(i, { checkOutDate: e.target.value })} /></Grid>
                    </Grid>
                  </Card>
                );
              })}
            </>
          ) : (
            <>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: '#1B4B35' }}>Transport Details</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField select fullWidth size="small" label="Vehicle Type *" error={!!errs.vehicleType} helperText={errs.vehicleType}
                    value={form.vehicleType} onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}>
                    {VEHICLE_TYPES.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth size="small" type="date" label="Travel Date *" InputLabelProps={{ shrink: true }}
                  error={!!errs.travelDate} helperText={errs.travelDate} value={form.travelDate} onChange={(e) => setForm({ ...form, travelDate: e.target.value })} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Pickup Location *" error={!!errs.pickupLocation} helperText={errs.pickupLocation}
                  value={form.pickupLocation} onChange={(e) => setForm({ ...form, pickupLocation: e.target.value })} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Drop-off Location *" error={!!errs.dropoffLocation} helperText={errs.dropoffLocation}
                  value={form.dropoffLocation} onChange={(e) => setForm({ ...form, dropoffLocation: e.target.value })} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="No. of Passengers" type="number"
                  inputProps={{ onKeyDown: numericOnly }} value={form.passengerCount} onChange={(e) => setForm({ ...form, passengerCount: e.target.value })} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Total Price *" error={!!errs.transportPrice} helperText={errs.transportPrice}
                  InputProps={{ startAdornment: <InputAdornment position="start">SAR</InputAdornment> }}
                  inputProps={{ onKeyDown: numericOnly }} value={form.transportPrice} onChange={(e) => setForm({ ...form, transportPrice: e.target.value })} /></Grid>
              </Grid>
            </>
          )}

          {/* Auto-calculated total */}
          <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: '#0D2B1A', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2">
              Total Value {isHotel && `(${form.trips.length} trip${form.trips.length > 1 ? 's' : ''})`}
            </Typography>
            <Typography variant="h6" sx={{ color: '#C9A227', fontWeight: 800 }}>{SAR(liveTotal)}</Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
          <Button color="inherit" startIcon={<RestartAlt />} onClick={handleReset} disabled={saving}>Reset</Button>
          <Box>
            <Button onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant="contained" onClick={() => { if (validate()) setConfirmSubmit(true); }} disabled={saving}>Create Voucher</Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Confirmation-before-submit dialog */}
      <Dialog open={confirmSubmit} onClose={() => setConfirmSubmit(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Create this voucher?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">Voucher <strong>{voucherNo}</strong> ({form.type}) for <strong>{form.firstName} {form.lastName}</strong> with total <strong>{SAR(liveTotal)}</strong> will be saved as <strong>Tentative</strong>.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmSubmit(false)} disabled={saving}>Back</Button>
          <Button variant="contained" onClick={doSubmit} disabled={saving}>{saving ? <CircularProgress size={18} color="inherit" /> : 'Confirm & Create'}</Button>
        </DialogActions>
      </Dialog>

      {/* Convert-to-Confirmed (HCN) dialog */}
      <Dialog open={!!hcnDialog} onClose={() => setHcnDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#1B4B35' }}>Convert to Confirmed</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>Enter the Hotel Confirmation Number (HCN). Once confirmed, this voucher cannot revert to Tentative.</Alert>
          <TextField autoFocus fullWidth size="small" label="HCN # *" value={hcn} onChange={(e) => setHcn(e.target.value)}
            helperText="Alphanumeric" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHcnDialog(null)}>Cancel</Button>
          <Button variant="contained" color="success" startIcon={<CheckCircle />} onClick={confirmVoucher}>Confirm Voucher</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
