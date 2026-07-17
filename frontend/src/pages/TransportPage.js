import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Card, CardContent, Grid, Table, TableBody, TableCell, TableHead, TableRow, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Tabs, Tab, Chip, IconButton, Tooltip, Drawer, Divider, Autocomplete } from '@mui/material';
import { Add, DirectionsBus, Route, Delete, AttachMoney, Build, FileDownload } from '@mui/icons-material';
import api from '../services/api';
import BulkImport from '../components/BulkImport';
import { exportToXlsx } from '../utils/exportXlsx';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { useForm, Controller } from 'react-hook-form';

const DEFAULT_VEHICLE_TYPES = ['BUS', 'CAR', 'VIP', 'SUV', 'VAN', 'COASTER', 'SEDAN', 'MINIBUS', 'TRUCK', 'LIMOUSINE'];
const TYPE_COLORS = { BUS: 'primary', CAR: 'default', VIP: 'warning', SUV: 'info', VAN: 'secondary', COASTER: 'success' };
const TYPE_ICONS = { BUS: '🚌', CAR: '🚗', VIP: '🏎️', SUV: '🚙', VAN: '🚐', COASTER: '🚍', MINIBUS: '🚐', TRUCK: '🚚', LIMOUSINE: '🚘' };
const colorFor = (t) => TYPE_COLORS[t] || 'default';
const iconFor = (t) => TYPE_ICONS[t] || '🚐';
// Read an uploaded file (receipt image/PDF) as a base64 data URL.
const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = reject;
  r.readAsDataURL(file);
});
const EMPTY_TRIP = { startLabel: '', endLabel: '', distanceKm: '', notes: '' };
import { PATTERNS, MESSAGES, alphaOnly, numericOnly } from '../utils/validation';

// Saudi mobile: starts with 966 followed by exactly 9 digits (total 12 digits)
const PHONE_SA = /^966[0-9]{9}$/;

export default function TransportPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState(0);
  const [vehicles, setVehicles] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vehicleDialog, setVehicleDialog] = useState(false);
  const [routeDialog, setRouteDialog] = useState(false);
  const [editVehicle, setEditVehicle] = useState(null);
  const [editRoute, setEditRoute] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [fleetVehicle, setFleetVehicle] = useState(null); // vehicle whose fleet drawer is open
  const [tripVehicle, setTripVehicle] = useState(null);   // vehicle whose Add Trip dialog is open
  const [tripForm, setTripForm] = useState(EMPTY_TRIP);
  const [tripSaving, setTripSaving] = useState(false);
  // Oil-change prompt after a trip crosses the interval: step 'ask' (Yes/No) → 'evidence'
  const [oilPrompt, setOilPrompt] = useState(null); // { vehicle, step }
  const [oilOdo, setOilOdo] = useState('');
  const [oilFile, setOilFile] = useState(null);
  const [oilSaving, setOilSaving] = useState(false);

  const { register: regV, handleSubmit: hsV, reset: resetV, control: ctrlV, formState: { errors: errV } } = useForm();
  const [vehicleTypes, setVehicleTypes] = useState(DEFAULT_VEHICLE_TYPES);
  const { register: regR, handleSubmit: hsR, reset: resetR, formState: { errors: errR } } = useForm();

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/transport/vehicles'), api.get('/transport/routes')])
      .then(([v, r]) => { setVehicles(v.data || []); setRoutes(r.data || []); })
      .catch((err) => toast.error(err.response?.data?.error || 'Failed to load transport data'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    // Configurable vehicle types from System Config (falls back to defaults).
    api.get('/config').then((r) => {
      const raw = (r.data?.vehicle_types || '').trim();
      const list = raw ? raw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) : [];
      setVehicleTypes(list.length ? Array.from(new Set([...list])) : DEFAULT_VEHICLE_TYPES);
    }).catch(() => {});
    // Only ACTIVE users holding the "Driver" role can be assigned to a vehicle.
    // NOTE: GET /users is paginated → the array is in r.data.data, not r.data.
    if (isAdmin) {
      api.get('/users', { params: { limit: 200 } })
        .then((r) => {
          const list = Array.isArray(r.data) ? r.data : (r.data?.data || []);
          setDrivers(list.filter((u) => u.isActive !== false && /driver/i.test(u.customRole?.name || '')));
        })
        .catch(() => {});
    }
  }, [isAdmin]);

  const onVehicle = async (data) => {
    try {
      if (editVehicle) await api.put(`/transport/vehicles/${editVehicle.id}`, data);
      else await api.post('/transport/vehicles', data);
      toast.success(editVehicle ? 'Vehicle updated' : 'Vehicle added');
      setVehicleDialog(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save vehicle');
    }
  };

  const onRoute = async (data) => {
    try {
      if (editRoute) await api.put(`/transport/routes/${editRoute.id}`, data);
      else await api.post('/transport/routes', data);
      toast.success('Route saved');
      setRouteDialog(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save route');
    }
  };

  const deleteVehicle = async (v) => {
    if (!window.confirm(`Delete vehicle "${v.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/transport/vehicles/${v.id}`);
      toast.success('Vehicle deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Cannot delete — vehicle may be assigned to a booking');
    }
  };

  const deleteRoute = async (r) => {
    if (!window.confirm(`Delete route "${r.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/transport/routes/${r.id}`);
      toast.success('Route deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Cannot delete — route may be assigned to a booking');
    }
  };

  const openVehicle = (v = null) => {
    setEditVehicle(v);
    const d = (x) => (x ? String(x).slice(0, 10) : ''); // ISO → YYYY-MM-DD for date inputs
    if (v) {
      resetV({
        ...v,
        istimaraExpiry: d(v.istimaraExpiry), iqamaExpiry: d(v.iqamaExpiry), kartashkeelExpiry: d(v.kartashkeelExpiry),
        licenseExpiry: d(v.licenseExpiry), bathakaSaicExpiry: d(v.bathakaSaicExpiry), ajeerExpiry: d(v.ajeerExpiry),
        tameenExpiry: d(v.tameenExpiry), fahasExpiry: d(v.fahasExpiry), nusuk: v.nusuk ? 'true' : 'false',
      });
    } else {
      resetV({
        type: 'BUS', capacity: 20, isAvailable: true, nusuk: 'false',
        istimaraExpiry: '', iqamaExpiry: '', kartashkeelExpiry: '', licenseExpiry: '',
        bathakaSaicExpiry: '', ajeerExpiry: '', tameenExpiry: '', fahasExpiry: '',
      });
    }
    setVehicleDialog(true);
  };
  const openRoute   = (r = null) => { setEditRoute(r);   resetR(r || {}); setRouteDialog(true); };

  // ── Add Trip (driver enters From / To / km; odometer advances automatically) ─
  const submitTrip = async () => {
    if (!tripForm.startLabel.trim()) return toast.error('From Location is required');
    if (!tripForm.endLabel.trim()) return toast.error('To Location is required');
    const dist = Number(tripForm.distanceKm);
    if (!dist || dist <= 0) return toast.error('Enter the trip distance in km');
    setTripSaving(true);
    try {
      const r = await api.post('/fleet/trips', {
        vehicleId: tripVehicle.id, startLabel: tripForm.startLabel.trim(),
        endLabel: tripForm.endLabel.trim(), distanceKm: dist, notes: tripForm.notes || undefined,
      });
      toast.success(`Trip logged — Current Odo Meter is now ${(r.data.vehicleOdometer || 0).toLocaleString()} km`);
      const veh = tripVehicle;
      setTripVehicle(null); setTripForm(EMPTY_TRIP); load();
      // Interval reached → maintenance task auto-created; ask the driver now.
      if (r.data.oil?.due) {
        setOilOdo(String(r.data.vehicleOdometer || ''));
        setOilFile(null);
        setOilPrompt({ vehicle: veh, step: 'ask' });
      }
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to log trip'); }
    finally { setTripSaving(false); }
  };

  const answerOilPrompt = async (changed) => {
    if (!changed) {
      setOilSaving(true);
      try {
        await api.post('/fleet/maintenance/confirm', { vehicleId: oilPrompt.vehicle.id, completed: false });
        toast.info('Logged: oil NOT changed — the task stays pending under Maintenance.');
        setOilPrompt(null); load();
      } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
      finally { setOilSaving(false); }
      return;
    }
    setOilPrompt((p) => ({ ...p, step: 'evidence' }));
  };

  const submitOilEvidence = async () => {
    if (!oilOdo || Number(oilOdo) <= 0) return toast.error('Enter the current odo meter reading');
    if (!oilFile) return toast.error('Upload the receipt voucher/invoice as evidence');
    if (oilFile.size > 5 * 1024 * 1024) return toast.error('Receipt file must be under 5 MB');
    setOilSaving(true);
    try {
      const receiptData = await readFileAsDataUrl(oilFile);
      await api.post('/fleet/maintenance/confirm', {
        vehicleId: oilPrompt.vehicle.id, completed: true,
        performedOdometer: Number(oilOdo), receiptData, receiptName: oilFile.name,
      });
      toast.success('Oil change confirmed with receipt evidence');
      setOilPrompt(null); load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to confirm'); }
    finally { setOilSaving(false); }
  };


  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Transport Management</Typography>
        {isAdmin && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            {tab === 0
              ? <BulkImport entity="vehicles" label="Vehicles" onDone={load} />
              : <BulkImport entity="routes" label="Routes" onDone={load} />}
            <Button variant="outlined" startIcon={<Add />} onClick={() => openVehicle()}>Add Vehicle</Button>
            <Button variant="contained" startIcon={<Add />} onClick={() => openRoute()}>Add Route</Button>
          </Box>
        )}
      </Box>

      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label={`Vehicles (${vehicles.length})`} icon={<DirectionsBus />} iconPosition="start" />
        <Tab label={`Routes (${routes.length})`} icon={<Route />} iconPosition="start" />
      </Tabs>

      {loading ? <Box sx={{ textAlign: 'center', mt: 4 }}><CircularProgress /></Box> : (
        <>
          {tab === 0 && (
            <Grid container spacing={2}>
              {vehicles.map((v) => (
                <Grid item xs={12} sm={6} md={4} key={v.id}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="h5">{iconFor(v.type)}</Typography>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Chip label={v.type} color={colorFor(v.type)} size="small" />
                          <Chip label={v.isAvailable ? 'Available' : 'Busy'} color={v.isAvailable ? 'success' : 'error'} size="small" />
                        </Box>
                      </Box>
                      <Typography variant="subtitle1" fontWeight={700}>{v.name}</Typography>
                      <Typography variant="caption" color="text.secondary">Plate: {v.plateNumber} | Capacity: {v.capacity}</Typography>
                      <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid #f1f5f9' }}>
                        <Typography variant="caption" display="block">Driver: {v.driverName}</Typography>
                        <Typography variant="caption" display="block" color="text.secondary">{v.driverPhone}</Typography>
                        {v.driverIqama && <Typography variant="caption" display="block" color="text.secondary">Iqama #: {v.driverIqama}</Typography>}
                        <Typography variant="caption" display="block" color="text.secondary">
                          Initial Odo: {(v.initialOdometer || 0).toLocaleString()} km · <strong>Current Odo: {(v.currentOdometer || 0).toLocaleString()} km</strong>
                        </Typography>
                      </Box>
                      {/* Per-vehicle fleet features */}
                      <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
                        <Button size="small" variant="contained" startIcon={<Route />} onClick={() => { setTripVehicle(v); setTripForm(EMPTY_TRIP); }}>Add Trip</Button>
                        <Button size="small" variant="outlined" startIcon={<AttachMoney />} onClick={() => setFleetVehicle({ ...v, _tab: 'cash' })}>Cash Log</Button>
                        <Button size="small" variant="outlined" startIcon={<Build />} onClick={() => setFleetVehicle({ ...v, _tab: 'maint' })}>Maintenance</Button>
                      </Box>
                      {isAdmin && (
                        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                          <Button size="small" onClick={() => openVehicle(v)}>Edit</Button>
                          <Tooltip title="Delete vehicle">
                            <IconButton size="small" color="error" onClick={() => deleteVehicle(v)}><Delete fontSize="small" /></IconButton>
                          </Tooltip>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
              {vehicles.length === 0 && <Grid item xs={12}><Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>No vehicles found. Click "Add Vehicle" to get started.</Typography></Grid>}
            </Grid>
          )}

          {tab === 1 && (
            <Card>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Route Name</TableCell>
                    <TableCell>From</TableCell>
                    <TableCell>To</TableCell>
                    <TableCell>Vehicle</TableCell>
                    {isAdmin && <TableCell>Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {routes.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{r.name}</TableCell>
                      <TableCell>{r.fromLocation}</TableCell>
                      <TableCell>{r.toLocation}</TableCell>
                      <TableCell>{r.vehicle?.name || '-'}</TableCell>
                      {isAdmin && (
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Button size="small" onClick={() => openRoute(r)}>Edit</Button>
                            <Tooltip title="Delete route">
                              <IconButton size="small" color="error" onClick={() => deleteRoute(r)}><Delete fontSize="small" /></IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {routes.length === 0 && <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>No routes found. Click "Add Route" to get started.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}

      {/* Vehicle Dialog */}
      <Dialog open={vehicleDialog} onClose={() => setVehicleDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editVehicle ? 'Edit Vehicle' : 'Add Vehicle'}</DialogTitle>
        <form onSubmit={hsV(onVehicle)}>
          <DialogContent dividers>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={8}>
                <TextField fullWidth label="Vehicle Name *" error={!!errV.name} helperText={errV.name?.message}
                  {...regV('name', { required: 'Name required' })} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Controller name="type" control={ctrlV} defaultValue={editVehicle?.type || 'BUS'}
                  render={({ field }) => (
                    <Autocomplete freeSolo options={vehicleTypes}
                      value={field.value || ''}
                      onChange={(_, v) => field.onChange((v || '').toUpperCase())}
                      onInputChange={(_, v) => field.onChange((v || '').toUpperCase())}
                      renderInput={(params) => <TextField {...params} fullWidth label="Type"
                        helperText="Pick or type a type — manage the list in System Config" />}
                    />
                  )} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Plate Number *" error={!!errV.plateNumber} helperText={errV.plateNumber?.message}
                  {...regV('plateNumber', { required: 'Plate required', pattern: { value: PATTERNS.PLATE, message: MESSAGES.PLATE } })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Capacity" type="number" inputProps={{ min: 1, onKeyDown: numericOnly }}
                  {...regV('capacity', { valueAsNumber: true, min: { value: 1, message: 'Min 1' } })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Driver Name" inputProps={{ onKeyDown: alphaOnly }}
                  error={!!errV.driverName} helperText={errV.driverName?.message}
                  {...regV('driverName', { pattern: { value: PATTERNS.ALPHA_ONLY, message: MESSAGES.ALPHA_ONLY } })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Driver Phone *"
                  error={!!errV.driverPhone}
                  helperText={errV.driverPhone?.message || 'Format: 966XXXXXXXXX (12 digits)'}
                  inputProps={{ maxLength: 12, onKeyDown: numericOnly }}
                  {...regV('driverPhone', {
                    required: 'Phone required',
                    pattern: { value: PHONE_SA, message: 'Must be 966XXXXXXXXX (12 digits, starts with 966)' },
                  })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Driver Iqama # *"
                  error={!!errV.driverIqama}
                  helperText={errV.driverIqama?.message || 'Exactly 10 digits (numeric only)'}
                  inputProps={{ maxLength: 10, inputMode: 'numeric', onKeyDown: numericOnly }}
                  {...regV('driverIqama', {
                    required: 'Iqama # required',
                    pattern: { value: /^\d{10}$/, message: 'Iqama # must be exactly 10 digits' },
                  })} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth select label="Assigned Driver (login account)" defaultValue={editVehicle?.driverId || ''}
                  helperText="Links a driver user so they can log trips/cash/maintenance for this vehicle only"
                  {...regV('driverId')}>
                  <MenuItem value="">— none —</MenuItem>
                  {drivers.map((d) => <MenuItem key={d.id} value={d.id}>{d.name} ({d.email})</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth label="Initial Odo Meter (km)" type="number" inputProps={{ min: 0, onKeyDown: numericOnly }}
                  helperText={editVehicle ? `Current Odo Meter: ${(editVehicle.currentOdometer || 0).toLocaleString()} km (auto — trips add to it)` : 'Current Odo Meter starts at this value'}
                  {...regV('initialOdometer', { valueAsNumber: true })} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth label="Oil Change Interval (km)" type="number" defaultValue={5000} inputProps={{ min: 0, onKeyDown: numericOnly }}
                  {...regV('oilChangeIntervalKm', { valueAsNumber: true })} />
              </Grid>
              {/* ── Compliance documents (all mandatory; expiry dates) ── */}
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }}><Chip label="Compliance Documents (all required)" size="small" /></Divider>
              </Grid>
              {[
                ['istimaraExpiry', 'Istimara'], ['iqamaExpiry', 'Iqama'], ['kartashkeelExpiry', 'Kart Tashkeel'],
                ['licenseExpiry', 'License'], ['bathakaSaicExpiry', 'Bathaka SAIC'], ['ajeerExpiry', 'Ajeer'],
                ['tameenExpiry', 'Tameen'], ['fahasExpiry', 'Fahas'],
              ].map(([key, label]) => (
                <Grid item xs={12} sm={6} md={4} key={key}>
                  <TextField fullWidth type="date" label={`${label} Expiry *`} InputLabelProps={{ shrink: true }}
                    error={!!errV[key]} helperText={errV[key]?.message}
                    {...regV(key, { required: `${label} date is required` })} />
                </Grid>
              ))}
              <Grid item xs={12} sm={6} md={4}>
                <Controller name="nusuk" control={ctrlV} defaultValue={editVehicle?.nusuk ? 'true' : 'false'}
                  rules={{ required: 'Nusuk is required' }}
                  render={({ field }) => (
                    <TextField {...field} fullWidth select label="Nusuk *" error={!!errV.nusuk} helperText={errV.nusuk?.message}>
                      <MenuItem value="true">Yes</MenuItem>
                      <MenuItem value="false">No</MenuItem>
                    </TextField>
                  )} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Notes" {...regV('notes')} />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setVehicleDialog(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Save</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Route Dialog */}
      <Dialog open={routeDialog} onClose={() => setRouteDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editRoute ? 'Edit Route' : 'Add Route'}</DialogTitle>
        <form onSubmit={hsR(onRoute)}>
          <DialogContent dividers>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField fullWidth label="Route Name *" error={!!errR.name} helperText={errR.name?.message}
                  {...regR('name', { required: 'Route name required' })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="From Location" {...regR('fromLocation')} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="To Location" {...regR('toLocation')} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Description" {...regR('description')} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth select label="Assign Vehicle (optional)" defaultValue="" {...regR('vehicleId')}>
                  <MenuItem value="">None</MenuItem>
                  {vehicles.map((v) => <MenuItem key={v.id} value={v.id}>{v.name} ({v.plateNumber})</MenuItem>)}
                </TextField>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRouteDialog(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Save</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Add Trip dialog (driver logs From / To / km) */}
      <Dialog open={!!tripVehicle} onClose={() => !tripSaving && setTripVehicle(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Trip — {tripVehicle?.name}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.25 }}>
            <Grid item xs={12}><TextField fullWidth size="small" label="From Location *" value={tripForm.startLabel} onChange={(e) => setTripForm((f) => ({ ...f, startLabel: e.target.value }))} /></Grid>
            <Grid item xs={12}><TextField fullWidth size="small" label="To Location *" value={tripForm.endLabel} onChange={(e) => setTripForm((f) => ({ ...f, endLabel: e.target.value }))} /></Grid>
            <Grid item xs={12}><TextField fullWidth size="small" label="Trip Distance (km) *" type="number" inputProps={{ min: 1 }}
              helperText={`Adds to Current Odo Meter (now ${(tripVehicle?.currentOdometer || 0).toLocaleString()} km)`}
              value={tripForm.distanceKm} onChange={(e) => setTripForm((f) => ({ ...f, distanceKm: e.target.value }))} /></Grid>
            <Grid item xs={12}><TextField fullWidth size="small" label="Notes" value={tripForm.notes} onChange={(e) => setTripForm((f) => ({ ...f, notes: e.target.value }))} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTripVehicle(null)} disabled={tripSaving}>Cancel</Button>
          <Button variant="contained" onClick={submitTrip} disabled={tripSaving}>{tripSaving ? <CircularProgress size={18} color="inherit" /> : 'Save Trip'}</Button>
        </DialogActions>
      </Dialog>

      {/* Oil-change prompt: interval reached → ask driver Yes/No, evidence on Yes */}
      <Dialog open={!!oilPrompt} onClose={() => !oilSaving && setOilPrompt(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ bgcolor: '#C0392B' }}>Oil Change Required — {oilPrompt?.vehicle?.name}</DialogTitle>
        <DialogContent>
          {oilPrompt?.step === 'ask' ? (
            <Typography variant="body2" sx={{ mt: 1 }}>
              The Current Odo Meter has reached the Oil Change Interval. A maintenance task has been created.
              <br /><strong>Has the oil been changed?</strong>
            </Typography>
          ) : (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" sx={{ mb: 2 }}>Enter the current odo meter value and upload the receipt voucher/invoice as evidence.</Typography>
              <TextField fullWidth size="small" label="Current Odo Meter (km) *" type="number" sx={{ mb: 2 }}
                value={oilOdo} onChange={(e) => setOilOdo(e.target.value)} />
              <Button component="label" variant="outlined" fullWidth sx={{ mb: 1 }}>
                {oilFile ? `📎 ${oilFile.name}` : 'Upload Receipt / Invoice *'}
                <input type="file" hidden accept="image/*,application/pdf" onChange={(e) => setOilFile(e.target.files?.[0] || null)} />
              </Button>
              <Typography variant="caption" color="text.secondary">Image or PDF, max 5 MB</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
          {oilPrompt?.step === 'ask' ? (
            <>
              <Button color="inherit" onClick={() => answerOilPrompt(false)} disabled={oilSaving}>No</Button>
              <Button variant="contained" color="success" onClick={() => answerOilPrompt(true)} disabled={oilSaving}>Yes, Oil Changed</Button>
            </>
          ) : (
            <>
              <Button color="inherit" onClick={() => setOilPrompt(null)} disabled={oilSaving}>Later</Button>
              <Button variant="contained" color="success" onClick={submitOilEvidence} disabled={oilSaving}>{oilSaving ? <CircularProgress size={18} color="inherit" /> : 'Confirm Oil Change'}</Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Per-vehicle fleet drawer (Cash Log + Maintenance) */}
      <Drawer anchor="right" open={!!fleetVehicle} onClose={() => setFleetVehicle(null)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 480 }, p: 0,
          // Override the global dark-green Drawer theme (used by the sidebar) so
          // form fields are dark-on-white and readable. Header keeps its branding.
          bgcolor: '#fff', color: 'text.primary',
          '& .MuiInputBase-input': { color: 'text.primary' },
          '& .MuiInputLabel-root': { color: 'text.secondary' },
        } }}>
        {fleetVehicle && <VehicleFleetDrawer vehicle={fleetVehicle} onClose={() => setFleetVehicle(null)} onChanged={load} />}
      </Drawer>
    </Box>
  );
}

// ── Per-vehicle Cash Log + Maintenance panel ──────────────────────────────────
function VehicleFleetDrawer({ vehicle, onClose, onChanged }) {
  const { isAdmin } = useAuth(); // cash delete route is ADMIN-only
  const [tab, setTab] = useState(vehicle._tab === 'maint' ? 1 : 0);
  const [cash, setCash] = useState({ data: [], totalAmount: 0, totalExpense: 0, totalNet: 0 });
  const [cashForm, setCashForm] = useState({ amount: '', expense: '', logDate: new Date().toISOString().substring(0, 10), notes: '' });
  const [oil, setOil] = useState(null);
  const [history, setHistory] = useState([]);
  const [odo, setOdo] = useState('');
  const SAR = (n) => `SAR ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const KM = (n) => `${Number(n || 0).toLocaleString()} km`;
  const OILC = { DUE: 'error', SOON: 'warning', OK: 'success' };

  const loadCash = () => api.get('/fleet/cash', { params: { vehicleId: vehicle.id } }).then((r) => setCash(r.data)).catch(() => {});
  const loadMaint = () => {
    api.get('/fleet/maintenance/alerts').then((r) => setOil((r.data.vehicles || []).find((x) => x.vehicleId === vehicle.id) || null)).catch(() => {});
    api.get('/fleet/maintenance', { params: { vehicleId: vehicle.id } }).then((r) => setHistory(r.data.data || [])).catch(() => {});
  };
  useEffect(() => { loadCash(); loadMaint(); setOdo(String(vehicle.currentOdometer || '')); /* eslint-disable-next-line */ }, [vehicle.id]);

  const submitCash = async () => {
    if (cashForm.amount === '' || Number(cashForm.amount) < 0) return toast.error('Enter a valid amount');
    if (cashForm.expense !== '' && Number(cashForm.expense) < 0) return toast.error('Expense cannot be negative');
    try { await api.post('/fleet/cash', { vehicleId: vehicle.id, ...cashForm }); toast.success('Cash submitted'); setCashForm({ amount: '', expense: '', logDate: new Date().toISOString().substring(0, 10), notes: '' }); loadCash(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };
  const delCash = async (c) => { if (!window.confirm('Delete this cash entry?')) return; try { await api.delete(`/fleet/cash/${c.id}`); toast.success('Deleted'); loadCash(); } catch (e) { toast.error(e.response?.data?.error || 'Failed'); } };
  const exportCash = () => {
    if (!cash.data.length) return toast.info('No cash entries to export');
    const rows = cash.data.map((c) => ({
      Submitted: new Date(c.submittedAt).toLocaleString(),
      'For Date': new Date(c.logDate).toLocaleDateString(),
      Amount: Number(c.amount || 0),
      Expense: Number(c.expense || 0),
      'Net Total': Number(c.amount || 0) - Number(c.expense || 0),
      Notes: c.notes || '',
    }));
    exportToXlsx(rows, `cash-${(vehicle.plateNumber || vehicle.name || 'vehicle').replace(/\s+/g, '_')}.xlsx`, 'Cash Log');
  };
  const [maintFile, setMaintFile] = useState(null);
  const confirmOil = async (completed) => {
    try {
      let receiptData, receiptName;
      if (completed) {
        if (!odo || Number(odo) <= 0) return toast.error('Enter the current odo meter reading');
        if (!maintFile) return toast.error('Upload the receipt voucher/invoice as evidence');
        if (maintFile.size > 5 * 1024 * 1024) return toast.error('Receipt file must be under 5 MB');
        receiptData = await readFileAsDataUrl(maintFile);
        receiptName = maintFile.name;
      }
      await api.post('/fleet/maintenance/confirm', { vehicleId: vehicle.id, completed, performedOdometer: odo || undefined, receiptData, receiptName });
      toast.success(completed ? 'Oil change confirmed with receipt' : 'Logged as not done');
      setMaintFile(null); loadMaint(); onChanged && onChanged();
    }
    catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };
  const openReceipt = async (id) => {
    try {
      const r = await api.get(`/fleet/maintenance/${id}/receipt`);
      const w = window.open('', '_blank');
      if (!w) return toast.error('Pop-up blocked — allow pop-ups to view the receipt');
      const d = r.data.receiptData || '';
      w.document.write(d.startsWith('data:application/pdf')
        ? `<iframe src="${d}" style="width:100%;height:100vh;border:0"></iframe>`
        : `<img src="${d}" style="max-width:100%" alt="receipt"/>`);
      w.document.close();
    } catch { toast.error('Failed to load receipt'); }
  };

  return (
    <Box>
      <Box sx={{ p: 2, bgcolor: '#1B4B35', color: '#fff' }}>
        <Typography variant="subtitle1" fontWeight={700}>{vehicle.name}</Typography>
        <Typography variant="caption">{vehicle.plateNumber} · {vehicle.driverName || 'No driver'} · {KM(vehicle.currentOdometer)}</Typography>
      </Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth">
        <Tab label="Cash Log" /><Tab label="Maintenance" />
      </Tabs>
      <Box sx={{ p: 2 }}>
        {tab === 0 && (
          <>
            <Typography variant="subtitle2" gutterBottom>Submit Cash</Typography>
            <TextField fullWidth size="small" label="Amount" type="number" sx={{ mb: 1.5 }} value={cashForm.amount} onChange={(e) => setCashForm((f) => ({ ...f, amount: e.target.value }))} />
            <TextField fullWidth size="small" label="Expense" type="number" sx={{ mb: 1.5 }} value={cashForm.expense} onChange={(e) => setCashForm((f) => ({ ...f, expense: e.target.value }))} />
            <TextField fullWidth size="small" label="Net Total" sx={{ mb: 1.5 }} value={SAR((Number(cashForm.amount) || 0) - (Number(cashForm.expense) || 0))} InputProps={{ readOnly: true }} />
            <TextField fullWidth size="small" type="date" label="Date" sx={{ mb: 1.5 }} InputLabelProps={{ shrink: true }} value={cashForm.logDate} onChange={(e) => setCashForm((f) => ({ ...f, logDate: e.target.value }))} />
            <TextField fullWidth size="small" label="Notes" sx={{ mb: 1.5 }} value={cashForm.notes} onChange={(e) => setCashForm((f) => ({ ...f, notes: e.target.value }))} />
            <Button fullWidth variant="contained" startIcon={<AttachMoney />} onClick={submitCash}>Submit Cash</Button>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2">Recent</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" color="primary.main">Amt {SAR(cash.totalAmount)} · Exp {SAR(cash.totalExpense)} · Net {SAR(cash.totalNet)}</Typography>
                <Button size="small" startIcon={<FileDownload />} onClick={exportCash} disabled={!cash.data.length}>Export</Button>
              </Box>
            </Box>
            <Table size="small">
              <TableHead><TableRow><TableCell>Submitted</TableCell><TableCell>For</TableCell><TableCell align="right">Amount</TableCell><TableCell align="right">Expense</TableCell><TableCell align="right">Net Total</TableCell><TableCell>Notes</TableCell>{isAdmin && <TableCell align="right"></TableCell>}</TableRow></TableHead>
              <TableBody>
                {cash.data.map((c) => (
                  <TableRow key={c.id}><TableCell><Typography variant="caption">{new Date(c.submittedAt).toLocaleString()}</Typography></TableCell>
                    <TableCell><Typography variant="caption">{new Date(c.logDate).toLocaleDateString()}</Typography></TableCell>
                    <TableCell align="right">{SAR(c.amount)}</TableCell>
                    <TableCell align="right">{SAR(c.expense)}</TableCell>
                    <TableCell align="right"><strong>{SAR(Number(c.amount || 0) - Number(c.expense || 0))}</strong></TableCell>
                    <TableCell><Typography variant="caption">{c.notes || ''}</Typography></TableCell>
                    {isAdmin && <TableCell align="right"><Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => delCash(c)}><Delete fontSize="small" /></IconButton></Tooltip></TableCell>}</TableRow>
                ))}
                {cash.data.length === 0 && <TableRow><TableCell colSpan={isAdmin ? 7 : 6} align="center" sx={{ color: 'text.secondary', py: 2 }}>No cash logged.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </>
        )}
        {tab === 1 && (
          <>
            <Typography variant="subtitle2" gutterBottom>Oil Change Status</Typography>
            {oil ? (
              <Box sx={{ mb: 2 }}>
                <Chip label={oil.status === 'DUE' ? 'Oil Due' : oil.status === 'SOON' ? 'Oil Soon' : 'OK'} color={OILC[oil.status] || 'success'} sx={{ mb: 1 }} />
                <Typography variant="body2">Since last change: {KM(oil.kmSinceOil)} / {KM(oil.intervalKm)}</Typography>
                <Typography variant="body2" sx={{ color: oil.kmRemaining <= 0 ? 'error.main' : 'text.secondary' }}>
                  {oil.kmRemaining <= 0 ? `${KM(Math.abs(oil.kmRemaining))} over due` : `${KM(oil.kmRemaining)} remaining`}
                </Typography>
              </Box>
            ) : <Typography variant="caption" color="text.secondary">Loading…</Typography>}
            <TextField fullWidth size="small" label="Current Odo Meter at service (km)" type="number" sx={{ mb: 1.5 }} value={odo} onChange={(e) => setOdo(e.target.value)} />
            <Button component="label" variant="outlined" fullWidth size="small" sx={{ mb: 1.5 }}>
              {maintFile ? `📎 ${maintFile.name}` : 'Upload Receipt / Invoice (required for Done)'}
              <input type="file" hidden accept="image/*,application/pdf" onChange={(e) => setMaintFile(e.target.files?.[0] || null)} />
            </Button>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Button fullWidth variant="contained" color="success" onClick={() => confirmOil(true)}>Oil Change Done</Button>
              <Button fullWidth variant="outlined" color="inherit" onClick={() => confirmOil(false)}>Not Done</Button>
            </Box>
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2" gutterBottom>History</Typography>
            <Table size="small">
              <TableHead><TableRow><TableCell>Date</TableCell><TableCell>Status</TableCell><TableCell align="right">Odo</TableCell><TableCell>By</TableCell></TableRow></TableHead>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id}><TableCell><Typography variant="caption">{new Date(h.createdAt).toLocaleDateString()}</Typography></TableCell>
                    <TableCell><Chip size="small" label={h.status} color={h.status === 'COMPLETED' ? 'success' : 'default'} /></TableCell>
                    <TableCell align="right">{h.performedOdometer ? KM(h.performedOdometer) : '—'}</TableCell>
                    <TableCell>
                      <Typography variant="caption">{h.confirmedByName || '—'}</Typography>
                      {h.hasReceipt && <Button size="small" sx={{ minWidth: 0, p: 0, ml: 0.5 }} onClick={() => openReceipt(h.id)}>📎</Button>}
                    </TableCell></TableRow>
                ))}
                {history.length === 0 && <TableRow><TableCell colSpan={4} align="center" sx={{ color: 'text.secondary', py: 2 }}>No records.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </>
        )}
        <Button fullWidth sx={{ mt: 2 }} onClick={onClose}>Close</Button>
      </Box>
    </Box>
  );
}
