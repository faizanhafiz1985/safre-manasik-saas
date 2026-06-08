import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Card, CardContent, Grid, Table, TableBody, TableCell, TableHead, TableRow, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Tabs, Tab, Chip, IconButton, Tooltip, Drawer, Divider } from '@mui/material';
import { Add, DirectionsBus, Route, Delete, AttachMoney, Build } from '@mui/icons-material';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { useForm } from 'react-hook-form';
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

  const { register: regV, handleSubmit: hsV, reset: resetV, formState: { errors: errV } } = useForm();
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

  const openVehicle = (v = null) => { setEditVehicle(v); resetV(v || { type: 'BUS', capacity: 20, isAvailable: true }); setVehicleDialog(true); };
  const openRoute   = (r = null) => { setEditRoute(r);   resetR(r || {}); setRouteDialog(true); };

  const typeColor = { BUS: 'primary', CAR: 'default', VIP: 'warning' };
  const typeIcon  = { BUS: '🚌', CAR: '🚗', VIP: '🏎️' };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Transport Management</Typography>
        {isAdmin && (
          <Box sx={{ display: 'flex', gap: 1 }}>
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
                        <Typography variant="h5">{typeIcon[v.type]}</Typography>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Chip label={v.type} color={typeColor[v.type]} size="small" />
                          <Chip label={v.isAvailable ? 'Available' : 'Busy'} color={v.isAvailable ? 'success' : 'error'} size="small" />
                        </Box>
                      </Box>
                      <Typography variant="subtitle1" fontWeight={700}>{v.name}</Typography>
                      <Typography variant="caption" color="text.secondary">Plate: {v.plateNumber} | Capacity: {v.capacity}</Typography>
                      <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid #f1f5f9' }}>
                        <Typography variant="caption" display="block">Driver: {v.driverName}</Typography>
                        <Typography variant="caption" display="block" color="text.secondary">{v.driverPhone}</Typography>
                        <Typography variant="caption" display="block" color="text.secondary">Odometer: {(v.currentOdometer || 0).toLocaleString()} km</Typography>
                      </Box>
                      {/* Per-vehicle fleet features */}
                      <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
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
                <TextField fullWidth select label="Type" defaultValue="BUS" {...regV('type')}>
                  <MenuItem value="BUS">Bus</MenuItem>
                  <MenuItem value="CAR">Car</MenuItem>
                  <MenuItem value="VIP">VIP</MenuItem>
                </TextField>
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
              <Grid item xs={12}>
                <TextField fullWidth select label="Assigned Driver (login account)" defaultValue={editVehicle?.driverId || ''}
                  helperText="Links a driver user so they can log trips/cash/maintenance for this vehicle only"
                  {...regV('driverId')}>
                  <MenuItem value="">— none —</MenuItem>
                  {drivers.map((d) => <MenuItem key={d.id} value={d.id}>{d.name} ({d.email})</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth label="Current Odometer (km)" type="number" inputProps={{ min: 0, onKeyDown: numericOnly }}
                  {...regV('currentOdometer', { valueAsNumber: true })} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth label="Oil Change Interval (km)" type="number" defaultValue={5000} inputProps={{ min: 0, onKeyDown: numericOnly }}
                  {...regV('oilChangeIntervalKm', { valueAsNumber: true })} />
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

      {/* Per-vehicle fleet drawer (Cash Log + Maintenance) */}
      <Drawer anchor="right" open={!!fleetVehicle} onClose={() => setFleetVehicle(null)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 480 }, p: 0 } }}>
        {fleetVehicle && <VehicleFleetDrawer vehicle={fleetVehicle} onClose={() => setFleetVehicle(null)} onChanged={load} />}
      </Drawer>
    </Box>
  );
}

// ── Per-vehicle Cash Log + Maintenance panel ──────────────────────────────────
function VehicleFleetDrawer({ vehicle, onClose, onChanged }) {
  const [tab, setTab] = useState(vehicle._tab === 'maint' ? 1 : 0);
  const [cash, setCash] = useState({ data: [], totalAmount: 0 });
  const [cashForm, setCashForm] = useState({ amount: '', logDate: new Date().toISOString().substring(0, 10), notes: '' });
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
    try { await api.post('/fleet/cash', { vehicleId: vehicle.id, ...cashForm }); toast.success('Cash submitted'); setCashForm({ amount: '', logDate: new Date().toISOString().substring(0, 10), notes: '' }); loadCash(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };
  const confirmOil = async (completed) => {
    try { await api.post('/fleet/maintenance/confirm', { vehicleId: vehicle.id, completed, performedOdometer: odo || undefined }); toast.success(completed ? 'Oil change confirmed' : 'Logged as not done'); loadMaint(); onChanged && onChanged(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
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
            <TextField fullWidth size="small" type="date" label="Date" sx={{ mb: 1.5 }} InputLabelProps={{ shrink: true }} value={cashForm.logDate} onChange={(e) => setCashForm((f) => ({ ...f, logDate: e.target.value }))} />
            <TextField fullWidth size="small" label="Notes" sx={{ mb: 1.5 }} value={cashForm.notes} onChange={(e) => setCashForm((f) => ({ ...f, notes: e.target.value }))} />
            <Button fullWidth variant="contained" startIcon={<AttachMoney />} onClick={submitCash}>Submit Cash</Button>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2">Recent</Typography>
              <Typography variant="subtitle2" color="primary.main">Total: {SAR(cash.totalAmount)}</Typography>
            </Box>
            <Table size="small">
              <TableHead><TableRow><TableCell>Submitted</TableCell><TableCell>For</TableCell><TableCell align="right">Amount</TableCell></TableRow></TableHead>
              <TableBody>
                {cash.data.map((c) => (
                  <TableRow key={c.id}><TableCell><Typography variant="caption">{new Date(c.submittedAt).toLocaleString()}</Typography></TableCell>
                    <TableCell><Typography variant="caption">{new Date(c.logDate).toLocaleDateString()}</Typography></TableCell>
                    <TableCell align="right">{SAR(c.amount)}</TableCell></TableRow>
                ))}
                {cash.data.length === 0 && <TableRow><TableCell colSpan={3} align="center" sx={{ color: 'text.secondary', py: 2 }}>No cash logged.</TableCell></TableRow>}
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
            <TextField fullWidth size="small" label="Odometer at service (km)" type="number" sx={{ mb: 1.5 }} value={odo} onChange={(e) => setOdo(e.target.value)} />
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
                    <TableCell><Typography variant="caption">{h.confirmedByName || '—'}</Typography></TableCell></TableRow>
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
