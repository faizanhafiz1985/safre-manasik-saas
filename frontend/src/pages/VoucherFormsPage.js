import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Button, Card, Table, TableBody, TableCell, TableHead, TableRow,
  CircularProgress, Chip, TextField, InputAdornment, MenuItem, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, TablePagination, IconButton, Tooltip,
  ToggleButton, ToggleButtonGroup, Alert, Divider, InputLabel, FormControl, Select,
} from '@mui/material';
import {
  Add, Search, Receipt, Delete, CheckCircle, Hotel as HotelIcon, DirectionsBus,
  RestartAlt, Edit, Block, Description, RequestQuote, Paid,
} from '@mui/icons-material';
import api from '../services/api';
import BulkImport from '../components/BulkImport';
import { toast } from 'react-toastify';
import { fmtDate } from '../utils/helpers';
import { PATTERNS, numericOnly, alphaOnly } from '../utils/validation';

const SAR = (n) => `SAR ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
const D12 = /^\d{12}$/;
const ALPHANUM = /^[A-Za-z0-9]+$/;
const DEFAULT_VEHICLE_TYPES = ['Sedan', 'SUV (GMC)', 'Van (Hiace)', 'Coaster', 'Bus (50-seater)', 'VIP'];
const ROOM_TYPES = ['Sharing', 'Double', 'Triple', 'Quad', 'Quint'];
const STATUS_COLOR = { TENTATIVE: 'warning', CONFIRMED: 'success', CANCELLED: 'default' };

const EMPTY_HOTEL_TRIP = { hotelId: '', hotelName: '', checkInDate: '', checkOutDate: '', rooms: '1', roomType: '', passengerCount: '', perNightPrice: '' };
const EMPTY_TRANSPORT_TRIP = { vehicleType: '', pickupLocation: '', dropoffLocation: '', travelDate: '', passengerCount: '', price: '' };
const emptyTrip = (type) => (type === 'HOTEL' ? { ...EMPTY_HOTEL_TRIP } : { ...EMPTY_TRANSPORT_TRIP });
const EMPTY = { type: 'HOTEL', companyName: '', firstName: '', lastName: '', mobile: '', whatsapp: '', passport: '', trips: [{ ...EMPTY_HOTEL_TRIP }] };

function nights(ci, co) {
  if (!ci || !co) return 0;
  const a = new Date(ci); const b = new Date(co);
  const d = Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
  return d > 0 ? d : 0;
}
const dateOnly = (d) => (d ? String(d).split('T')[0] : '');

export default function VoucherFormsPage() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errs, setErrs] = useState({});
  const [voucherNo, setVoucherNo] = useState('—');
  const [hotels, setHotels] = useState([]);
  const [vehicleTypes, setVehicleTypes] = useState(DEFAULT_VEHICLE_TYPES);
  const [saving, setSaving] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const [hcnDialog, setHcnDialog] = useState(null);
  const [hcn, setHcn] = useState('');

  const [payDialog, setPayDialog] = useState(null);
  const [payForm, setPayForm] = useState({ method: 'CASH', reference: '' });

  const load = useCallback(() => {
    setLoading(true);
    api.get('/voucher-forms', { params: { page: page + 1, limit: 15, ...(search && { search }), ...(statusFilter && { status: statusFilter }) } })
      .then((r) => { setRows(r.data.data || []); setTotal(r.data.total || 0); })
      .catch((e) => toast.error(e.response?.data?.error || 'Failed to load vouchers'))
      .finally(() => setLoading(false));
  }, [page, search, statusFilter]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    // Configurable vehicle types from System Config → Fleet Settings (falls back to defaults).
    api.get('/config').then((r) => {
      const raw = (r.data?.vehicle_types || '').trim();
      const list = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [];
      setVehicleTypes(list.length ? Array.from(new Set(list)) : DEFAULT_VEHICLE_TYPES);
    }).catch(() => {});
  }, []);

  const isHotel = form.type === 'HOTEL';

  const fetchHotels = () => api.get('/hotels').then((h) => setHotels(Array.isArray(h.data) ? h.data : (h.data.data || []))).catch(() => setHotels([]));

  const openNew = async () => {
    setEditingId(null); setForm(EMPTY); setErrs({}); setVoucherNo('…'); setOpen(true);
    try {
      const n = await api.get('/voucher-forms/next-number');
      setVoucherNo(n.data.voucherNo);
    } catch { setVoucherNo('(auto)'); }
    fetchHotels();
  };

  const openEdit = async (v) => {
    setErrs({}); setOpen(true); setVoucherNo(v.voucherNo); setEditingId(v.id);
    fetchHotels();
    try {
      const r = await api.get(`/voucher-forms/${v.id}`);
      const d = r.data;
      const trips = Array.isArray(d.trips) && d.trips.length
        ? d.trips.map((t) => d.type === 'HOTEL'
          ? { hotelId: t.hotelId || '', hotelName: t.hotelName || '', checkInDate: dateOnly(t.checkInDate), checkOutDate: dateOnly(t.checkOutDate), rooms: t.rooms != null ? String(t.rooms) : '1', roomType: t.roomType || '', passengerCount: t.passengerCount != null ? String(t.passengerCount) : '', perNightPrice: t.perNightPrice != null ? String(t.perNightPrice) : '' }
          : { vehicleType: t.vehicleType || '', pickupLocation: t.pickupLocation || '', dropoffLocation: t.dropoffLocation || '', travelDate: dateOnly(t.travelDate), passengerCount: t.passengerCount != null ? String(t.passengerCount) : '', price: t.price != null ? String(t.price) : '' })
        : [emptyTrip(d.type)];
      setForm({
        type: d.type, companyName: d.companyName || '', firstName: d.firstName || '', lastName: d.lastName || '',
        mobile: d.mobile || '', whatsapp: d.whatsapp || '', passport: d.passport || '', trips,
      });
    } catch { toast.error('Failed to load voucher'); setOpen(false); }
  };

  const tripTotal = (t) => isHotel ? Math.max(1, Number(t.rooms || 1)) * nights(t.checkInDate, t.checkOutDate) * Number(t.perNightPrice || 0) : Number(t.price || 0);
  const liveTotal = (form.trips || []).reduce((s, t) => s + tripTotal(t), 0);

  const updateTrip = (idx, patch) => setForm((f) => ({ ...f, trips: f.trips.map((t, i) => i === idx ? { ...t, ...patch } : t) }));
  const addTrip = () => setForm((f) => ({ ...f, trips: [...f.trips, emptyTrip(f.type)] }));
  const removeTrip = (idx) => setForm((f) => ({ ...f, trips: f.trips.length > 1 ? f.trips.filter((_, i) => i !== idx) : f.trips }));

  const onHotelSelect = (idx, hotelId) => {
    const h = hotels.find((x) => x.id === hotelId);
    updateTrip(idx, { hotelId, hotelName: h?.name || '', perNightPrice: h?.pricePerNight != null ? String(h.pricePerNight) : form.trips[idx].perNightPrice });
  };

  function validate() {
    const e = {};
    if (!form.firstName || !PATTERNS.ALPHA_ONLY.test(form.firstName.trim())) e.firstName = 'Letters only, required';
    if (!form.lastName || !PATTERNS.ALPHA_ONLY.test(form.lastName.trim())) e.lastName = 'Letters only, required';
    if (form.companyName && !PATTERNS.ALPHA_ONLY.test(form.companyName.trim())) e.companyName = 'Letters only';
    if (!D12.test((form.mobile || '').replace(/\s/g, ''))) e.mobile = 'Exactly 12 digits';
    if (form.whatsapp && !D12.test((form.whatsapp || '').replace(/\s/g, ''))) e.whatsapp = 'Exactly 12 digits';
    if (!form.passport || !ALPHANUM.test(form.passport.trim())) e.passport = 'Alphanumeric, required';
    e.trips = (form.trips || []).map((t) => {
      const te = {};
      if (isHotel) {
        if (!t.hotelName) te.hotelName = 'Select a hotel';
        if (!t.checkInDate) te.checkInDate = 'Required';
        if (!t.checkOutDate) te.checkOutDate = 'Required';
        if (t.checkInDate && t.checkOutDate && nights(t.checkInDate, t.checkOutDate) <= 0) te.checkOutDate = 'After check-in';
        if (t.rooms === '' || isNaN(Number(t.rooms)) || Number(t.rooms) < 1) te.rooms = 'Min 1';
        if (t.perNightPrice === '' || isNaN(Number(t.perNightPrice))) te.perNightPrice = 'Required';
      } else {
        if (!t.vehicleType) te.vehicleType = 'Required';
        if (!t.pickupLocation) te.pickupLocation = 'Required';
        if (!t.dropoffLocation) te.dropoffLocation = 'Required';
        if (!t.travelDate) te.travelDate = 'Required';
        if (t.price === '' || isNaN(Number(t.price))) te.price = 'Required';
      }
      return te;
    });
    if (e.trips.every((te) => Object.keys(te).length === 0)) delete e.trips;
    setErrs(e);
    return Object.keys(e).length === 0;
  }

  // Open a server-rendered HTML document (voucher/invoice) in a new tab for print.
  const openPrintDoc = async (path) => {
    try {
      const r = await api.get(path, { responseType: 'text' });
      const w = window.open('', '_blank');
      if (!w) return toast.error('Pop-up blocked — allow pop-ups to print');
      w.document.write(r.data); w.document.close();
    } catch { toast.error('Failed to load document'); }
  };

  const doSubmit = async () => {
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/voucher-forms/${editingId}`, form);
        toast.success('Voucher updated — Proforma invoice refreshed');
        setConfirmSubmit(false); setOpen(false); load();
      } else {
        const res = await api.post('/voucher-forms', form);
        toast.success('Voucher created (Tentative) — Proforma invoice generated');
        setConfirmSubmit(false); setOpen(false); load();
        // Auto-generate & print the Proforma invoice.
        if (res.data?.id) openPrintDoc(`/voucher-forms/${res.data.id}/invoice/PROFORMA/print`);
      }
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to save voucher');
    } finally { setSaving(false); }
  };

  const handleReset = () => {
    if (window.confirm('Reset the form? All entered data will be cleared.')) { setForm({ ...EMPTY, type: form.type, trips: [emptyTrip(form.type)] }); setErrs({}); }
  };

  const confirmVoucher = async () => {
    const h = (hcn || '').trim();
    if (h && !ALPHANUM.test(h)) return toast.error('HCN # must be alphanumeric (or leave blank)');
    try {
      const vid = hcnDialog.id;
      await api.patch(`/voucher-forms/${vid}/confirm`, { hcn: h });
      toast.success('Voucher confirmed — Tax invoice generated');
      setHcnDialog(null); setHcn(''); load();
      // Auto-generate & print the Actual (tax) invoice.
      openPrintDoc(`/voucher-forms/${vid}/invoice/ACTUAL/print`);
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to confirm'); }
  };

  const recordPayment = async () => {
    if (!payForm.method) return toast.error('Select a payment method');
    try {
      await api.patch(`/voucher-forms/${payDialog.id}/payment`, payForm);
      toast.success('Payment recorded');
      setPayDialog(null); setPayForm({ method: 'CASH', reference: '' }); load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to record payment'); }
  };

  const printInvoice = (v, docType) => openPrintDoc(`/voucher-forms/${v.id}/invoice/${docType}/print`);

  const cancelVoucher = async (v) => {
    if (!window.confirm(`Cancel voucher ${v.voucherNo}? This cannot be undone.`)) return;
    try { await api.patch(`/voucher-forms/${v.id}/cancel`); toast.success('Voucher cancelled'); load(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed to cancel'); }
  };

  const printVoucher = (v) => openPrintDoc(`/voucher-forms/${v.id}/print`);

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
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <BulkImport entity="hotel_vouchers" label="Direct Vouchers — Hotel" onDone={load} />
          <BulkImport entity="transport_vouchers" label="Direct Vouchers — Transport" onDone={load} />
          <Button variant="contained" startIcon={<Add />} onClick={openNew}>New Voucher</Button>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField placeholder="Search voucher #, name, mobile, hotel, HCN…" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }} sx={{ flex: 1, minWidth: 240 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} />
        <TextField select label="Status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }} sx={{ width: 180 }}>
          <MenuItem value="">All</MenuItem>
          <MenuItem value="TENTATIVE">Tentative</MenuItem>
          <MenuItem value="CONFIRMED">Confirmed</MenuItem>
          <MenuItem value="CANCELLED">Cancelled</MenuItem>
        </TextField>
      </Box>

      <Card>
        {loading ? <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box> : (
          <>
            <Box sx={{ overflowX: 'auto' }}>
              <Table>
                <TableHead><TableRow>
                  <TableCell>Voucher #</TableCell><TableCell>Type</TableCell><TableCell>Customer</TableCell>
                  <TableCell>Status</TableCell><TableCell>Payment</TableCell><TableCell>HCN #</TableCell><TableCell align="right">Total</TableCell>
                  <TableCell>Created</TableCell><TableCell align="right">Actions</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {rows.map((v) => (
                    <TableRow key={v.id} hover sx={{ opacity: v.status === 'CANCELLED' ? 0.6 : 1 }}>
                      <TableCell sx={{ fontWeight: 700, fontFamily: 'monospace' }}>{v.voucherNo}</TableCell>
                      <TableCell><Chip size="small" icon={v.type === 'HOTEL' ? <HotelIcon fontSize="small" /> : <DirectionsBus fontSize="small" />} label={v.type} /></TableCell>
                      <TableCell>{v.firstName} {v.lastName}</TableCell>
                      <TableCell><Chip size="small" label={v.status} color={STATUS_COLOR[v.status] || 'default'} /></TableCell>
                      <TableCell>
                        {v.status === 'CANCELLED' ? '—'
                          : <Chip size="small" label={v.paymentStatus === 'PAID' ? 'PAID' : 'UNPAID'} color={v.paymentStatus === 'PAID' ? 'success' : 'error'} variant={v.paymentStatus === 'PAID' ? 'filled' : 'outlined'} />}
                      </TableCell>
                      <TableCell>{v.hcn || '—'}</TableCell>
                      <TableCell align="right">{SAR(v.totalValue)}</TableCell>
                      <TableCell><Typography variant="caption">{fmtDate(v.createdAt)}</Typography></TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                          {v.status === 'TENTATIVE' && (
                            <Tooltip title="Edit (tentative only)"><IconButton size="small" onClick={() => openEdit(v)}><Edit fontSize="small" /></IconButton></Tooltip>
                          )}
                          {v.status === 'TENTATIVE' && (
                            <Tooltip title="Convert to Confirmed"><IconButton size="small" color="success" onClick={() => { setHcnDialog(v); setHcn(''); }}><CheckCircle fontSize="small" /></IconButton></Tooltip>
                          )}
                          {v.status === 'CONFIRMED' && v.paymentStatus !== 'PAID' && (
                            <Tooltip title="Record payment"><IconButton size="small" color="success" onClick={() => { setPayDialog(v); setPayForm({ method: 'CASH', reference: '' }); }}><Paid fontSize="small" /></IconButton></Tooltip>
                          )}
                          {v.status !== 'CANCELLED' && (
                            <Tooltip title="Cancel voucher"><IconButton size="small" color="warning" onClick={() => cancelVoucher(v)}><Block fontSize="small" /></IconButton></Tooltip>
                          )}
                          <Tooltip title="Print voucher (no pricing)"><IconButton size="small" color="primary" onClick={() => printVoucher(v)}><Receipt fontSize="small" /></IconButton></Tooltip>
                          <Tooltip title="Print Proforma invoice"><IconButton size="small" onClick={() => printInvoice(v, 'PROFORMA')}><RequestQuote fontSize="small" /></IconButton></Tooltip>
                          {v.status === 'CONFIRMED' && (
                            <Tooltip title="Print Tax (Actual) invoice"><IconButton size="small" color="success" onClick={() => printInvoice(v, 'ACTUAL')}><Description fontSize="small" /></IconButton></Tooltip>
                          )}
                          {/* Confirmed vouchers are finalized records and cannot be deleted. */}
                          {v.status !== 'CONFIRMED' && (
                            <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => del(v)}><Delete fontSize="small" /></IconButton></Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>No vouchers yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </Box>
            <TablePagination rowsPerPageOptions={[15]} component="div" count={total} rowsPerPage={15} page={page} onPageChange={(_, p) => setPage(p)} />
          </>
        )}
      </Card>

      {/* New / Edit Voucher dialog */}
      <Dialog open={open} onClose={() => !saving && setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#1B4B35' }}>{editingId ? 'Edit Voucher' : 'New Voucher'}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, p: 1.5, borderRadius: 2, bgcolor: '#FFF8E7', border: '1px solid #F0D9A8' }}>
            <Chip label="TENTATIVE" color="warning" sx={{ fontWeight: 800, letterSpacing: 1 }} />
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" color="text.secondary">Voucher Number</Typography>
              <Typography variant="h6" sx={{ fontFamily: 'monospace', color: '#1B4B35', fontWeight: 700 }}>{voucherNo}</Typography>
            </Box>
          </Box>

          <ToggleButtonGroup exclusive size="small" color="primary" value={form.type} disabled={!!editingId}
            onChange={(_, v) => v && setForm({ ...EMPTY, type: v, trips: [emptyTrip(v)] })} sx={{ mb: 2 }}>
            <ToggleButton value="HOTEL" sx={{ px: 3 }}><HotelIcon fontSize="small" sx={{ mr: 1 }} /> Hotel Voucher</ToggleButton>
            <ToggleButton value="TRANSPORT" sx={{ px: 3 }}><DirectionsBus fontSize="small" sx={{ mr: 1 }} /> Transport Voucher</ToggleButton>
          </ToggleButtonGroup>

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

          {/* Trips repeater (works for both Hotel and Transport) */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#1B4B35' }}>{isHotel ? 'Hotel Trips' : 'Transport Trips'} ({form.trips.length})</Typography>
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
                      Subtotal: {SAR(tripTotal(t))}{isHotel ? ` (${Math.max(1, Number(t.rooms || 1))} room${Number(t.rooms) > 1 ? 's' : ''} × ${nights(t.checkInDate, t.checkOutDate)} nights)` : ''}
                    </Typography>
                    {form.trips.length > 1 && <IconButton size="small" color="error" onClick={() => removeTrip(i)}><Delete fontSize="small" /></IconButton>}
                  </Box>
                </Box>
                <Grid container spacing={2}>
                  {isHotel ? (
                    <>
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
                          inputProps={{ onKeyDown: numericOnly }} value={t.perNightPrice} onChange={(e) => updateTrip(i, { perNightPrice: e.target.value })} />
                      </Grid>
                      <Grid item xs={4} sm={4}><TextField fullWidth size="small" type="number" label="No. of Rooms *"
                        error={!!te.rooms} helperText={te.rooms || ''} inputProps={{ min: 1, onKeyDown: numericOnly }}
                        value={t.rooms} onChange={(e) => updateTrip(i, { rooms: e.target.value })} /></Grid>
                      <Grid item xs={4} sm={4}><TextField select fullWidth size="small" label="Room Type" error={!!te.roomType} helperText={te.roomType || ''}
                        value={t.roomType} onChange={(e) => updateTrip(i, { roomType: e.target.value })}>
                        <MenuItem value="">— select —</MenuItem>
                        {ROOM_TYPES.map((rt) => <MenuItem key={rt} value={rt}>{rt}</MenuItem>)}
                      </TextField></Grid>
                      <Grid item xs={4} sm={4}><TextField fullWidth size="small" type="number" label="No. of Pax"
                        error={!!te.passengerCount} helperText={te.passengerCount || ''} inputProps={{ min: 1, onKeyDown: numericOnly }}
                        value={t.passengerCount} onChange={(e) => updateTrip(i, { passengerCount: e.target.value })} /></Grid>
                      <Grid item xs={12} sm={6}><TextField fullWidth size="small" type="date" label="Check-in Date *" InputLabelProps={{ shrink: true }}
                        error={!!te.checkInDate} helperText={te.checkInDate} value={t.checkInDate} onChange={(e) => updateTrip(i, { checkInDate: e.target.value })} /></Grid>
                      <Grid item xs={12} sm={6}><TextField fullWidth size="small" type="date" label="Check-out Date *" InputLabelProps={{ shrink: true }}
                        inputProps={{ min: t.checkInDate || undefined }}
                        error={!!te.checkOutDate} helperText={te.checkOutDate} value={t.checkOutDate} onChange={(e) => updateTrip(i, { checkOutDate: e.target.value })} /></Grid>
                    </>
                  ) : (
                    <>
                      <Grid item xs={12} sm={6}>
                        <TextField select fullWidth size="small" label="Vehicle Type *" error={!!te.vehicleType} helperText={te.vehicleType}
                          value={t.vehicleType} onChange={(e) => updateTrip(i, { vehicleType: e.target.value })}>
                          {(t.vehicleType && !vehicleTypes.includes(t.vehicleType)
                            ? [t.vehicleType, ...vehicleTypes]
                            : vehicleTypes
                          ).map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                        </TextField>
                      </Grid>
                      <Grid item xs={12} sm={6}><TextField fullWidth size="small" type="date" label="Travel Date *" InputLabelProps={{ shrink: true }}
                        error={!!te.travelDate} helperText={te.travelDate} value={t.travelDate} onChange={(e) => updateTrip(i, { travelDate: e.target.value })} /></Grid>
                      <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Pickup Location *" error={!!te.pickupLocation} helperText={te.pickupLocation}
                        value={t.pickupLocation} onChange={(e) => updateTrip(i, { pickupLocation: e.target.value })} /></Grid>
                      <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Drop-off Location *" error={!!te.dropoffLocation} helperText={te.dropoffLocation}
                        value={t.dropoffLocation} onChange={(e) => updateTrip(i, { dropoffLocation: e.target.value })} /></Grid>
                      <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="No. of Passengers" type="number"
                        inputProps={{ onKeyDown: numericOnly }} value={t.passengerCount} onChange={(e) => updateTrip(i, { passengerCount: e.target.value })} /></Grid>
                      <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Trip Price *" error={!!te.price} helperText={te.price}
                        InputProps={{ startAdornment: <InputAdornment position="start">SAR</InputAdornment> }}
                        inputProps={{ onKeyDown: numericOnly }} value={t.price} onChange={(e) => updateTrip(i, { price: e.target.value })} /></Grid>
                    </>
                  )}
                </Grid>
              </Card>
            );
          })}

          {/* Auto-calculated total (excl. VAT — VAT breakdown shown on the printed voucher) */}
          <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: '#0D2B1A', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2">Total ({form.trips.length} trip{form.trips.length > 1 ? 's' : ''}, excl. VAT)</Typography>
            <Typography variant="h6" sx={{ color: '#C9A227', fontWeight: 800 }}>{SAR(liveTotal)}</Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
          <Button color="inherit" startIcon={<RestartAlt />} onClick={handleReset} disabled={saving}>Reset</Button>
          <Box>
            <Button onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant="contained" onClick={() => { if (validate()) setConfirmSubmit(true); }} disabled={saving}>{editingId ? 'Update Voucher' : 'Create Voucher'}</Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Confirmation-before-submit dialog */}
      <Dialog open={confirmSubmit} onClose={() => setConfirmSubmit(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingId ? 'Save changes?' : 'Create this voucher?'}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">Voucher <strong>{voucherNo}</strong> ({form.type}) for <strong>{form.firstName} {form.lastName}</strong> with subtotal <strong>{SAR(liveTotal)}</strong> (VAT added on print).</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmSubmit(false)} disabled={saving}>Back</Button>
          <Button variant="contained" onClick={doSubmit} disabled={saving}>{saving ? <CircularProgress size={18} color="inherit" /> : (editingId ? 'Save' : 'Confirm & Create')}</Button>
        </DialogActions>
      </Dialog>

      {/* Convert-to-Confirmed (HCN) dialog */}
      <Dialog open={!!hcnDialog} onClose={() => setHcnDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#1B4B35' }}>Convert to Confirmed</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>Confirming finalizes this voucher and issues the Tax invoice. HCN # is optional. Once confirmed, this voucher cannot revert to Tentative.</Alert>
          <TextField autoFocus fullWidth size="small" label="HCN # (optional)" value={hcn} onChange={(e) => setHcn(e.target.value)} helperText="Alphanumeric — leave blank if not yet available" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHcnDialog(null)}>Cancel</Button>
          <Button variant="contained" color="success" startIcon={<CheckCircle />} onClick={confirmVoucher}>Confirm Voucher</Button>
        </DialogActions>
      </Dialog>

      {/* Record-payment dialog (confirmed direct vouchers) */}
      <Dialog open={!!payDialog} onClose={() => setPayDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#1B4B35' }}>Record Payment</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>Payment is recorded once and cannot be edited afterwards. This action is audit-logged.</Alert>
          {payDialog && <Typography variant="body2" sx={{ mb: 2 }}>Voucher <strong>{payDialog.voucherNo}</strong> — {payDialog.firstName} {payDialog.lastName} · Total {SAR(payDialog.totalValue)} (incl. VAT on invoice).</Typography>}
          <TextField select fullWidth size="small" label="Payment Method" value={payForm.method} onChange={(e) => setPayForm((f) => ({ ...f, method: e.target.value }))} sx={{ mb: 2 }}>
            {['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE'].map((m) => <MenuItem key={m} value={m}>{m.replace('_', ' ')}</MenuItem>)}
          </TextField>
          <TextField fullWidth size="small" label="Reference (optional)" value={payForm.reference} onChange={(e) => setPayForm((f) => ({ ...f, reference: e.target.value }))} helperText="Transaction / receipt #" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPayDialog(null)}>Cancel</Button>
          <Button variant="contained" color="success" startIcon={<Paid />} onClick={recordPayment}>Mark as Paid</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
