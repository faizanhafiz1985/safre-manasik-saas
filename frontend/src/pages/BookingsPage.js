import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Card, CardContent, TextField, InputAdornment, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  CircularProgress, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, Autocomplete, IconButton, Tooltip, Divider,
} from '@mui/material';
import { Add, Search, Visibility, PersonAdd, Delete, Hotel as HotelIcon, DirectionsBus } from '@mui/icons-material';
import { Controller } from 'react-hook-form';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { useForm } from 'react-hook-form';
import { fmtCurrency, fmtDate, statusChip } from '../utils/helpers';
import { numericOnly, decimalOnly, PATTERNS, MESSAGES, alphaOnly } from '../utils/validation';

const VEHICLE_TYPES = ['Sedan', 'SUV (GMC)', 'Van (Hiace)', 'Coaster', 'Bus (50-seater)', 'VIP'];
const EMPTY_HOTEL_TRIP = { hotelId: '', hotelName: '', checkInDate: '', checkOutDate: '', rooms: '1', perNightPrice: '' };
const EMPTY_TRANSPORT_TRIP = { vehicleType: '', pickupLocation: '', dropoffLocation: '', travelDate: '', passengerCount: '', price: '' };
function tripNights(ci, co) {
  if (!ci || !co) return 0;
  const a = new Date(ci), b = new Date(co);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
  const d = Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
  return d > 0 ? d : 0;
}

export default function BookingsPage() {
  const { isAdmin, isAgent } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings]   = useState([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(0);
  const [rowsPerPage]             = useState(10);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [open, setOpen]           = useState(false);
  const [packages, setPackages]   = useState([]);
  const [customers, setCustomers] = useState([]);
  const [hotels, setHotels]       = useState([]);

  // ─── Booking form ──────────────────────────────────────────────────────────
  const { register, handleSubmit, watch, reset, control, setValue, formState: { errors } } = useForm();
  const selectedPkg = watch('packageId');
  const [selectedPkgData, setSelectedPkgData] = useState(null);

  // ─── Itinerary line-items (Direct-Voucher style) ──────────────────────────
  const [hotelTrips, setHotelTrips] = useState([]);
  const [transportTrips, setTransportTrips] = useState([]);

  const hotelLine = (t) => Math.max(1, Number(t.rooms || 1)) * tripNights(t.checkInDate, t.checkOutDate) * Number(t.perNightPrice || 0);
  const transportLine = (t) => Number(t.price || 0);
  const tripsTotal = hotelTrips.reduce((s, t) => s + hotelLine(t), 0) + transportTrips.reduce((s, t) => s + transportLine(t), 0);
  const hasTrips = hotelTrips.length > 0 || transportTrips.length > 0;

  const addHotelTrip = () => setHotelTrips((a) => [...a, { ...EMPTY_HOTEL_TRIP }]);
  const updateHotelTrip = (i, patch) => setHotelTrips((a) => a.map((t, idx) => idx === i ? { ...t, ...patch } : t));
  const removeHotelTrip = (i) => setHotelTrips((a) => a.filter((_, idx) => idx !== i));
  const onHotelPick = (i, hotelId) => {
    const h = hotels.find((x) => x.id === hotelId);
    updateHotelTrip(i, { hotelId, hotelName: h?.name || '', perNightPrice: h?.pricePerNight != null ? String(h.pricePerNight) : hotelTrips[i].perNightPrice });
  };
  const addTransportTrip = () => setTransportTrips((a) => [...a, { ...EMPTY_TRANSPORT_TRIP }]);
  const updateTransportTrip = (i, patch) => setTransportTrips((a) => a.map((t, idx) => idx === i ? { ...t, ...patch } : t));
  const removeTransportTrip = (i) => setTransportTrips((a) => a.filter((_, idx) => idx !== i));

  // Keep the (disabled) Total Amount field in sync with the itinerary total.
  useEffect(() => {
    if (hasTrips) setValue('totalAmount', Number(tripsTotal.toFixed(2)));
  }, [tripsTotal, hasTrips, setValue]);

  useEffect(() => {
    if (selectedPkg) setSelectedPkgData(packages.find((p) => p.id === selectedPkg));
  }, [selectedPkg, packages]);

  // ─── Quick-create customer dialog ─────────────────────────────────────────
  const [custOpen, setCustOpen] = useState(false);
  const {
    register: regCust,
    handleSubmit: submitCust,
    reset: resetCust,
    watch: watchCust,
    formState: { errors: custErrors },
  } = useForm();
  const custType = watchCust('customerType', 'B2C');

  const openCustDialog = () => {
    resetCust({ customerType: 'B2C' });
    setCustOpen(true);
  };

  const createCustomer = async (data) => {
    try {
      const res = await api.post('/users', { ...data, role: 'CUSTOMER' });
      const newCust = res.data;
      setCustomers((prev) => [...prev, newCust].sort((a, b) => a.name.localeCompare(b.name)));
      setValue('customerId', newCust.id);
      setCustOpen(false);
      toast.success(`Customer "${newCust.name}" created and selected`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create customer');
    }
  };

  // ─── Data loading ─────────────────────────────────────────────────────────
  const load = useCallback(() => {
    setLoading(true);
    const params = { page: page + 1, limit: rowsPerPage, ...(search && { search }), ...(statusFilter && { status: statusFilter }) };
    api.get('/bookings', { params })
      .then((r) => { setBookings(r.data.data || []); setTotal(r.data.total || 0); })
      .catch((err) => toast.error(err.response?.data?.error || 'Failed to load bookings'))
      .finally(() => setLoading(false));
  }, [page, rowsPerPage, search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (isAdmin || isAgent) {
      api.get('/packages').then((r) => setPackages(r.data.data || [])).catch(() => {});
      api.get('/users/customers').then((r) => setCustomers(r.data.data || [])).catch(() => {});
      api.get('/hotels').then((r) => setHotels(Array.isArray(r.data) ? r.data : (r.data.data || []))).catch(() => {});
    }
  }, [isAdmin, isAgent]);

  const openCreate = () => {
    reset({ totalPax: 1, status: 'TENTATIVE' });
    setSelectedPkgData(null);
    setHotelTrips([]);
    setTransportTrips([]);
    setOpen(true);
  };

  const onSubmit = async (data) => {
    try {
      const tier = selectedPkgData?.priceTiers?.find((t) => t.id === data.priceTierId);
      let amount;
      if (hasTrips) amount = tripsTotal;
      else if (tier) amount = Number(tier.pricePerPax) * Number(data.totalPax);
      else amount = data.totalAmount;
      await api.post('/bookings', { ...data, totalAmount: amount, hotelTrips, transportTrips, passengers: [] });
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
        {(isAdmin || isAgent) && (
          <Button variant="contained" startIcon={<Add />} onClick={openCreate}>New Booking</Button>
        )}
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth placeholder="Search by ref or customer name…"
                value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
              />
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

      {/* Table */}
      <Card>
        {loading ? (
          <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box>
        ) : (
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
                      <TableCell>
                        <Typography variant="caption">
                          {b.package?.name?.substring(0, 25)}{b.package?.name?.length > 25 ? '…' : ''}
                        </Typography>
                      </TableCell>
                      <TableCell><Typography variant="caption">{fmtDate(b.travelDateFrom)}</Typography></TableCell>
                      <TableCell>{b.totalPax}</TableCell>
                      <TableCell>{fmtCurrency(b.totalAmount)}</TableCell>
                      <TableCell>{statusChip(b.status)}</TableCell>
                      <TableCell>
                        <Button size="small" startIcon={<Visibility />} onClick={() => navigate(`/bookings/${b.id}`)}>View</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {bookings.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>No bookings found</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[10]} component="div"
              count={total} rowsPerPage={rowsPerPage} page={page}
              onPageChange={(_, p) => setPage(p)}
            />
          </>
        )}
      </Card>

      {/* ─── Create Booking Dialog ───────────────────────────────────────── */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Booking</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent dividers>
            <Grid container spacing={2}>

              {/* Customer field with quick-add button */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <Controller
                    name="customerId"
                    control={control}
                    rules={{ required: 'Please select a customer' }}
                    render={({ field: { onChange, value } }) => (
                      <Autocomplete
                        fullWidth
                        options={customers}
                        getOptionLabel={(c) => c?.name ? `${c.name} — ${c.email}` : ''}
                        isOptionEqualToValue={(o, v) => o.id === v?.id}
                        value={customers.find((c) => c.id === value) || null}
                        onChange={(_, newVal) => onChange(newVal?.id || null)}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Customer *"
                            error={!!errors.customerId}
                            helperText={errors.customerId?.message}
                          />
                        )}
                      />
                    )}
                  />
                  <Tooltip title="Quick-add new customer">
                    <IconButton
                      onClick={openCustDialog}
                      color="primary"
                      sx={{ border: 1, borderColor: 'primary.main', borderRadius: 1, height: 56, width: 56, flexShrink: 0 }}
                    >
                      <PersonAdd />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Can't find the customer? Click <strong>+</strong> to create one instantly.
                </Typography>
              </Grid>

              {/* Package (optional) */}
              <Grid item xs={12}>
                <TextField fullWidth select label="Package (optional)" defaultValue="" error={!!errors.packageId}
                  helperText="Leave as “None” for an ad-hoc booking; enter the amount manually below." {...register('packageId')}>
                  <MenuItem value=""><em>None (ad-hoc booking)</em></MenuItem>
                  {packages.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                </TextField>
              </Grid>

              {/* Price Tier (only if package has tiers) */}
              {selectedPkgData?.priceTiers?.length > 0 && (
                <Grid item xs={12}>
                  <TextField fullWidth select label="Price Tier" {...register('priceTierId')}>
                    {selectedPkgData.priceTiers.map((t) => (
                      <MenuItem key={t.id} value={t.id}>{t.tierName} — {fmtCurrency(t.pricePerPax)}/pax</MenuItem>
                    ))}
                  </TextField>
                </Grid>
              )}

              <Grid item xs={6}>
                <TextField fullWidth label="Departure Date" type="date" InputLabelProps={{ shrink: true }} {...register('travelDateFrom', { required: true })} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth label="Return Date" type="date" InputLabelProps={{ shrink: true }} {...register('travelDateTo', { required: true })} />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth label="Total Pax" type="number"
                  inputProps={{ min: 1, onKeyDown: numericOnly }}
                  {...register('totalPax', { min: { value: 1, message: 'Min 1' }, valueAsNumber: true })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth label="Total Amount (SAR)" type="number"
                  disabled={hasTrips}
                  helperText={hasTrips ? `Auto-calculated from itinerary: ${fmtCurrency(tripsTotal)}` : 'Enter manually for an ad-hoc booking'}
                  inputProps={{ min: 0, onKeyDown: decimalOnly }}
                  {...register('totalAmount', { valueAsNumber: true, min: { value: 0, message: 'Must be positive' } })}
                />
              </Grid>

              {/* ── Hotel Trips ─────────────────────────────────────────── */}
              <Grid item xs={12}>
                <Divider sx={{ mb: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2" fontWeight={700} color="primary.main" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <HotelIcon fontSize="small" /> Hotel Trips ({hotelTrips.length})
                  </Typography>
                  <Button size="small" startIcon={<Add />} variant="outlined" onClick={addHotelTrip}>Add Hotel</Button>
                </Box>
                {hotelTrips.map((t, i) => (
                  <Card key={i} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Chip size="small" label={`Hotel ${i + 1}`} />
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          {fmtCurrency(hotelLine(t))} ({Math.max(1, Number(t.rooms || 1))} rm × {tripNights(t.checkInDate, t.checkOutDate)} n)
                        </Typography>
                        <IconButton size="small" color="error" onClick={() => removeHotelTrip(i)}><Delete fontSize="small" /></IconButton>
                      </Box>
                    </Box>
                    <Grid container spacing={1.5}>
                      <Grid item xs={12} sm={6}>
                        <TextField select fullWidth size="small" label="Hotel" value={t.hotelId} onChange={(e) => onHotelPick(i, e.target.value)}>
                          {hotels.length === 0 && <MenuItem value="" disabled>No hotels — add hotels first</MenuItem>}
                          {hotels.map((h) => <MenuItem key={h.id} value={h.id}>{h.name}{h.city ? ` — ${h.city}` : ''}</MenuItem>)}
                        </TextField>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField fullWidth size="small" label="Per Night Price"
                          InputProps={{ startAdornment: <InputAdornment position="start">SAR</InputAdornment> }}
                          inputProps={{ onKeyDown: decimalOnly }} value={t.perNightPrice}
                          onChange={(e) => updateHotelTrip(i, { perNightPrice: e.target.value })} />
                      </Grid>
                      <Grid item xs={4} sm={4}>
                        <TextField fullWidth size="small" type="number" label="Rooms" inputProps={{ min: 1, onKeyDown: numericOnly }}
                          value={t.rooms} onChange={(e) => updateHotelTrip(i, { rooms: e.target.value })} />
                      </Grid>
                      <Grid item xs={8} sm={4}>
                        <TextField fullWidth size="small" type="date" label="Check-in" InputLabelProps={{ shrink: true }}
                          value={t.checkInDate} onChange={(e) => updateHotelTrip(i, { checkInDate: e.target.value })} />
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <TextField fullWidth size="small" type="date" label="Check-out" InputLabelProps={{ shrink: true }}
                          inputProps={{ min: t.checkInDate || undefined }}
                          value={t.checkOutDate} onChange={(e) => updateHotelTrip(i, { checkOutDate: e.target.value })} />
                      </Grid>
                    </Grid>
                  </Card>
                ))}
              </Grid>

              {/* ── Transport Trips ─────────────────────────────────────── */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2" fontWeight={700} color="primary.main" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <DirectionsBus fontSize="small" /> Transport Trips ({transportTrips.length})
                  </Typography>
                  <Button size="small" startIcon={<Add />} variant="outlined" onClick={addTransportTrip}>Add Transport</Button>
                </Box>
                {transportTrips.map((t, i) => (
                  <Card key={i} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Chip size="small" label={`Transport ${i + 1}`} />
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption" color="text.secondary">{fmtCurrency(transportLine(t))}</Typography>
                        <IconButton size="small" color="error" onClick={() => removeTransportTrip(i)}><Delete fontSize="small" /></IconButton>
                      </Box>
                    </Box>
                    <Grid container spacing={1.5}>
                      <Grid item xs={12} sm={6}>
                        <TextField select fullWidth size="small" label="Vehicle Type" value={t.vehicleType}
                          onChange={(e) => updateTransportTrip(i, { vehicleType: e.target.value })}>
                          {VEHICLE_TYPES.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                        </TextField>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField fullWidth size="small" type="date" label="Travel Date" InputLabelProps={{ shrink: true }}
                          value={t.travelDate} onChange={(e) => updateTransportTrip(i, { travelDate: e.target.value })} />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField fullWidth size="small" label="Pickup Location" value={t.pickupLocation}
                          onChange={(e) => updateTransportTrip(i, { pickupLocation: e.target.value })} />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField fullWidth size="small" label="Drop-off Location" value={t.dropoffLocation}
                          onChange={(e) => updateTransportTrip(i, { dropoffLocation: e.target.value })} />
                      </Grid>
                      <Grid item xs={6} sm={6}>
                        <TextField fullWidth size="small" type="number" label="No. of Passengers" inputProps={{ min: 1, onKeyDown: numericOnly }}
                          value={t.passengerCount} onChange={(e) => updateTransportTrip(i, { passengerCount: e.target.value })} />
                      </Grid>
                      <Grid item xs={6} sm={6}>
                        <TextField fullWidth size="small" label="Trip Price"
                          InputProps={{ startAdornment: <InputAdornment position="start">SAR</InputAdornment> }}
                          inputProps={{ onKeyDown: decimalOnly }} value={t.price}
                          onChange={(e) => updateTransportTrip(i, { price: e.target.value })} />
                      </Grid>
                    </Grid>
                  </Card>
                ))}
              </Grid>

              {hasTrips && (
                <Grid item xs={12}>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#0D2B1A', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">Itinerary Total ({hotelTrips.length + transportTrips.length} item{hotelTrips.length + transportTrips.length > 1 ? 's' : ''})</Typography>
                    <Typography variant="h6" sx={{ color: '#C9A227', fontWeight: 800 }}>{fmtCurrency(tripsTotal)}</Typography>
                  </Box>
                </Grid>
              )}

              <Grid item xs={12}>
                <TextField fullWidth multiline rows={2} label="Notes" {...register('notes')} />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Create Booking</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ─── Quick-Create Customer Dialog ────────────────────────────────── */}
      <Dialog open={custOpen} onClose={() => setCustOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonAdd fontSize="small" color="primary" /> New Customer
        </DialogTitle>
        <form onSubmit={submitCust(createCustomer)}>
          <DialogContent dividers>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth label="Full Name *" autoFocus
                  error={!!custErrors.name} helperText={custErrors.name?.message}
                  inputProps={{ onKeyDown: alphaOnly }}
                  {...regCust('name', { required: 'Name required', pattern: { value: PATTERNS.ALPHA_ONLY, message: MESSAGES.ALPHA_ONLY } })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth label="Email *"
                  error={!!custErrors.email} helperText={custErrors.email?.message}
                  {...regCust('email', { required: 'Email required', pattern: { value: PATTERNS.EMAIL, message: MESSAGES.EMAIL } })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Phone" {...regCust('phone')} />
              </Grid>
              <Grid item xs={12}>
                <Divider sx={{ mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">Type</Typography>
                </Divider>
                <TextField fullWidth select label="Customer Type" defaultValue="B2C" {...regCust('customerType')}>
                  <MenuItem value="B2C">B2C — Individual</MenuItem>
                  <MenuItem value="B2B">B2B — Corporate</MenuItem>
                </TextField>
              </Grid>
              {custType === 'B2B' && (
                <>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth label="Company Name *"
                      error={!!custErrors.companyName} helperText={custErrors.companyName?.message}
                      {...regCust('companyName', { required: 'Required for B2B' })}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth label="CR Number" {...regCust('crNumber')} />
                  </Grid>
                </>
              )}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCustOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" startIcon={<PersonAdd />}>Create &amp; Select</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
