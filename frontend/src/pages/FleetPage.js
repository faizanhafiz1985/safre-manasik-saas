import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Tabs, Tab, Card, CardContent, Grid, Table, TableHead, TableBody,
  TableRow, TableCell, Chip, Button, IconButton, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, CircularProgress, Alert, Stack, Divider,
} from '@mui/material';
import {
  PlayArrow, Stop, MyLocation, Add, Paid, Build, DirectionsCar, Route as RouteIcon,
  Speed, Warning, CheckCircle, Delete, AttachMoney, LocalGasStation, Badge, FileDownload,
} from '@mui/icons-material';
import api from '../services/api';
import { exportToXlsx } from '../utils/exportXlsx';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

const today = () => new Date().toISOString().substring(0, 10);
const SAR = (n) => `SAR ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
const km = (n) => `${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 1 })} km`;
const fmtDT = (d) => (d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const fmtD = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const OIL = { DUE: { label: 'Oil Due', color: 'error' }, SOON: { label: 'Oil Soon', color: 'warning' }, OK: { label: 'OK', color: 'success' } };

// Browser GPS — resolves {lat,lng} or null (with a toast on failure).
function getPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  });
}

export default function FleetPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState(0);
  const [vehicles, setVehicles] = useState([]);
  const loadVehicles = useCallback(() => {
    api.get('/transport/vehicles').then((r) => setVehicles(Array.isArray(r.data) ? r.data : (r.data.data || []))).catch(() => {});
  }, []);
  useEffect(() => { loadVehicles(); }, [loadVehicles]);

  // Custom-role users (e.g. Driver) only see the fleet sections they're granted —
  // a driver has no `fleet_dashboard` permission, so the Dashboard tab is hidden
  // and they land on Trips. Base-role users (ADMIN/AGENT) see every tab as before.
  const perms = new Set(user?.permissions || []);
  const isCustomRole = !!user?.customRoleId;
  const can = (f) => !isCustomRole || perms.has(`${f}:view`);
  const tabs = [
    can('fleet_dashboard') && { key: 'dashboard', label: 'Dashboard', icon: <Speed />, render: () => <DashboardTab /> },
    can('fleet_trips') && { key: 'trips', label: 'Trips', icon: <RouteIcon />, render: () => <TripsTab vehicles={vehicles} /> },
    can('fleet_cash') && { key: 'cash', label: 'Cash Log', icon: <AttachMoney />, render: () => <CashTab vehicles={vehicles} /> },
    can('fleet_maintenance') && { key: 'maintenance', label: 'Maintenance', icon: <Build />, render: () => <MaintenanceTab onChange={loadVehicles} /> },
    can('fleet_maintenance') && { key: 'documents', label: 'Documents', icon: <Badge />, render: () => <DocumentsTab /> },
  ].filter(Boolean);
  const active = Math.min(tab, Math.max(0, tabs.length - 1));

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={700} color="#1B4B35">Fleet Management</Typography>
        <Typography variant="body2" color="text.secondary">Trip tracking, cash accountability and maintenance alerts for your vehicles.</Typography>
      </Box>
      {tabs.length === 0 ? (
        <Alert severity="info">You don't have access to any fleet sections.</Alert>
      ) : (
        <>
          <Tabs value={active} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }} variant="scrollable" scrollButtons="auto">
            {tabs.map((t) => <Tab key={t.key} icon={t.icon} iconPosition="start" label={t.label} />)}
          </Tabs>
          {tabs[active].render()}
        </>
      )}
    </Box>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function DashboardTab() {
  const [date, setDate] = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    api.get('/fleet/dashboard', { params: { date } }).then((r) => setData(r.data)).catch((e) => toast.error(e.response?.data?.error || 'Failed to load')).finally(() => setLoading(false));
  }, [date]);
  useEffect(() => { load(); }, [load]);
  if (loading) return <Box sx={{ textAlign: 'center', mt: 6 }}><CircularProgress /></Box>;
  const s = data?.summary || {};
  const cards = [
    { label: 'Trips Today', value: s.totalTrips ?? 0, sub: `${s.activeTrips ?? 0} in progress`, icon: <RouteIcon />, color: '#1B4B35' },
    { label: 'Total Mileage', value: km(s.totalKm), sub: 'across all vehicles', icon: <Speed />, color: '#4A90D9' },
    { label: 'Cash Collected', value: SAR(s.totalCash), sub: 'submitted today', icon: <AttachMoney />, color: '#2E9E6B' },
    { label: 'Oil Changes Due', value: s.oilDue ?? 0, sub: 'vehicles', icon: <LocalGasStation />, color: s.oilDue ? '#C0392B' : '#94a3b8' },
  ];
  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <TextField type="date" size="small" label="Date" value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
      </Stack>
      {s.oilDue > 0 && <Alert severity="error" sx={{ mb: 2 }} icon={<Warning />}>{s.oilDue} vehicle(s) are due for an oil change. See the Maintenance tab.</Alert>}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {cards.map((c) => (
          <Grid item xs={6} md={3} key={c.label}>
            <Card sx={{ borderLeft: `4px solid ${c.color}` }}><CardContent sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
              <Box sx={{ color: c.color }}>{c.icon}</Box>
              <Box><Typography variant="caption" color="text.secondary">{c.label}</Typography><Typography variant="h6" fontWeight={700}>{c.value}</Typography><Typography variant="caption" color="text.secondary">{c.sub}</Typography></Box>
            </CardContent></Card>
          </Grid>
        ))}
      </Grid>
      <Card>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead><TableRow sx={{ bgcolor: '#F3F8F5' }}>
              <TableCell><strong>Vehicle</strong></TableCell><TableCell><strong>Driver</strong></TableCell>
              <TableCell align="center"><strong>Trips</strong></TableCell><TableCell align="right"><strong>Mileage</strong></TableCell>
              <TableCell align="right"><strong>Cash</strong></TableCell><TableCell><strong>Oil Status</strong></TableCell><TableCell><strong>Routes</strong></TableCell>
            </TableRow></TableHead>
            <TableBody>
              {(data?.rows || []).map((r, i) => (
                <TableRow key={i} hover>
                  <TableCell>{r.vehicleName || '—'}{r.plateNumber ? ` (${r.plateNumber})` : ''}</TableCell>
                  <TableCell>{r.driverName || '—'}</TableCell>
                  <TableCell align="center">{r.trips}</TableCell>
                  <TableCell align="right">{km(r.totalKm)}</TableCell>
                  <TableCell align="right">{SAR(r.cash)}</TableCell>
                  <TableCell>{r.oil ? <Chip size="small" label={(OIL[r.oil.status] || OIL.OK).label} color={(OIL[r.oil.status] || OIL.OK).color} /> : '—'}</TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {(r.routes || []).slice(0, 3).map((t) => `${t.from} → ${t.to}`).join(' · ') || '—'}{r.routes?.length > 3 ? ` +${r.routes.length - 3}` : ''}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
              {(!data?.rows || data.rows.length === 0) && <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>No fleet activity on {date}.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Box>
      </Card>
    </Box>
  );
}

// ── Trips ─────────────────────────────────────────────────────────────────────
function TripsTab({ vehicles }) {
  const [trips, setTrips] = useState([]);
  const [active, setActive] = useState(null);
  const [vehicleId, setVehicleId] = useState('');
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
  const [mForm, setMForm] = useState({ vehicleId: '', startLabel: '', endLabel: '', startOdometer: '', endOdometer: '', distanceKm: '', purpose: '' });

  const load = useCallback(() => {
    api.get('/fleet/trips', { params: { limit: 25 } }).then((r) => {
      setTrips(r.data.data || []);
      setActive((r.data.data || []).find((t) => t.status === 'IN_PROGRESS') || null);
    }).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const start = async () => {
    if (!vehicleId) return toast.error('Select a vehicle');
    setBusy(true);
    const pos = await getPosition();
    if (!pos) toast.info('GPS unavailable — trip will start without a start location');
    try {
      const r = await api.post('/fleet/trips/start', { vehicleId, startLat: pos?.lat, startLng: pos?.lng, startLabel: pos ? 'GPS start' : null });
      toast.success('Trip started');
      setActive(r.data); load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to start'); } finally { setBusy(false); }
  };
  const stop = async () => {
    if (!active) return;
    setBusy(true);
    const pos = await getPosition();
    const endOdometer = window.prompt('Enter the ending odometer reading (km) for accurate mileage, or leave blank to use GPS distance:');
    try {
      const r = await api.post(`/fleet/trips/${active.id}/stop`, { endLat: pos?.lat, endLng: pos?.lng, endLabel: pos ? 'GPS end' : null, endOdometer: endOdometer || undefined });
      toast.success(`Trip ended — ${km(r.data.trip.distanceKm)}`);
      if (r.data.oil?.status === 'DUE') toast.warn('⚠️ This vehicle is now due for an oil change!');
      setActive(null); load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to stop'); } finally { setBusy(false); }
  };
  const ping = async () => {
    if (!active) return;
    const pos = await getPosition();
    if (!pos) return toast.error('GPS unavailable');
    try { const r = await api.post(`/fleet/trips/${active.id}/point`, pos); toast.success(`Waypoint added (${r.data.points} pts)`); } catch { toast.error('Failed'); }
  };
  const saveManual = async () => {
    if (!mForm.vehicleId) return toast.error('Select a vehicle');
    if (!mForm.startLabel?.trim()) return toast.error('From location is required');
    if (!mForm.endLabel?.trim()) return toast.error('To location is required');
    const hasOdo = mForm.startOdometer !== '' && mForm.endOdometer !== '' && Number(mForm.endOdometer) > Number(mForm.startOdometer);
    if (!hasOdo && !(Number(mForm.distanceKm) > 0)) return toast.error('Enter a distance > 0 km (or valid start/end odometers)');
    try { await api.post('/fleet/trips', mForm); toast.success('Trip logged'); setManual(false); setMForm({ vehicleId: '', startLabel: '', endLabel: '', startOdometer: '', endOdometer: '', distanceKm: '', purpose: '' }); load(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };
  const del = async (t) => { if (!window.confirm('Delete this trip?')) return; try { await api.delete(`/fleet/trips/${t.id}`); load(); } catch (e) { toast.error(e.response?.data?.error || 'Failed'); } };

  return (
    <Box>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          {active ? (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
              <Chip color="success" label="TRIP IN PROGRESS" />
              <Typography variant="body2">{active.vehicle?.name || vehicles.find((v) => v.id === active.vehicleId)?.name} · started {fmtDT(active.startedAt)}</Typography>
              <Box sx={{ flex: 1 }} />
              <Button size="small" startIcon={<MyLocation />} onClick={ping} disabled={busy}>Add Waypoint</Button>
              <Button variant="contained" color="error" startIcon={<Stop />} onClick={stop} disabled={busy}>Stop Trip</Button>
            </Stack>
          ) : (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
              <TextField select size="small" label="Vehicle" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} sx={{ minWidth: 220 }}>
                {vehicles.map((v) => <MenuItem key={v.id} value={v.id}>{v.name} ({v.plateNumber})</MenuItem>)}
              </TextField>
              <Button variant="contained" startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <PlayArrow />} onClick={start} disabled={busy}>Start Trip (GPS)</Button>
              <Box sx={{ flex: 1 }} />
              <Button startIcon={<Add />} onClick={() => setManual(true)}>Log Trip Manually</Button>
            </Stack>
          )}
        </CardContent>
      </Card>

      <Card>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead><TableRow sx={{ bgcolor: '#F3F8F5' }}>
              <TableCell><strong>Vehicle</strong></TableCell><TableCell><strong>Driver</strong></TableCell><TableCell><strong>Start</strong></TableCell>
              <TableCell><strong>End</strong></TableCell><TableCell align="right"><strong>Distance</strong></TableCell><TableCell><strong>Status</strong></TableCell><TableCell align="right"><strong></strong></TableCell>
            </TableRow></TableHead>
            <TableBody>
              {trips.map((t) => (
                <TableRow key={t.id} hover>
                  <TableCell>{t.vehicle?.name} <Typography variant="caption" color="text.secondary">{t.vehicle?.plateNumber}</Typography></TableCell>
                  <TableCell>{t.driverName || '—'}</TableCell>
                  <TableCell><Typography variant="caption">{fmtDT(t.startedAt)}<br />{t.startLabel || (t.startLat ? `${Number(t.startLat).toFixed(3)},${Number(t.startLng).toFixed(3)}` : '')}</Typography></TableCell>
                  <TableCell><Typography variant="caption">{t.endedAt ? fmtDT(t.endedAt) : '—'}<br />{t.endLabel || ''}</Typography></TableCell>
                  <TableCell align="right">{km(t.distanceKm)}</TableCell>
                  <TableCell><Chip size="small" label={t.status} color={t.status === 'COMPLETED' ? 'success' : t.status === 'IN_PROGRESS' ? 'warning' : 'default'} /></TableCell>
                  <TableCell align="right"><Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => del(t)}><Delete fontSize="small" /></IconButton></Tooltip></TableCell>
                </TableRow>
              ))}
              {trips.length === 0 && <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>No trips yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Box>
      </Card>

      <Dialog open={manual} onClose={() => setManual(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Log Trip Manually</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}><TextField select fullWidth size="small" label="Vehicle" value={mForm.vehicleId} onChange={(e) => setMForm((f) => ({ ...f, vehicleId: e.target.value }))}>{vehicles.map((v) => <MenuItem key={v.id} value={v.id}>{v.name} ({v.plateNumber})</MenuItem>)}</TextField></Grid>
            <Grid item xs={6}><TextField fullWidth size="small" label="From" value={mForm.startLabel} onChange={(e) => setMForm((f) => ({ ...f, startLabel: e.target.value }))} /></Grid>
            <Grid item xs={6}><TextField fullWidth size="small" label="To" value={mForm.endLabel} onChange={(e) => setMForm((f) => ({ ...f, endLabel: e.target.value }))} /></Grid>
            <Grid item xs={4}><TextField fullWidth size="small" label="Start odo" type="number" value={mForm.startOdometer} onChange={(e) => setMForm((f) => ({ ...f, startOdometer: e.target.value }))} /></Grid>
            <Grid item xs={4}><TextField fullWidth size="small" label="End odo" type="number" value={mForm.endOdometer} onChange={(e) => setMForm((f) => ({ ...f, endOdometer: e.target.value }))} /></Grid>
            <Grid item xs={4}><TextField fullWidth size="small" label="Distance km" type="number" value={mForm.distanceKm} onChange={(e) => setMForm((f) => ({ ...f, distanceKm: e.target.value }))} helperText="or odo" /></Grid>
            <Grid item xs={12}><TextField fullWidth size="small" label="Purpose" value={mForm.purpose} onChange={(e) => setMForm((f) => ({ ...f, purpose: e.target.value }))} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions><Button onClick={() => setManual(false)}>Cancel</Button><Button variant="contained" onClick={saveManual}>Save Trip</Button></DialogActions>
      </Dialog>
    </Box>
  );
}

// ── Cash ──────────────────────────────────────────────────────────────────────
function CashTab({ vehicles }) {
  const { user } = useAuth();
  const canDelete = user?.role === 'ADMIN'; // delete route is ADMIN-only
  const [data, setData] = useState({ data: [], totalAmount: 0, totalExpense: 0, totalNet: 0 });
  const [payTypes, setPayTypes] = useState(['Cash', 'Voucher']);
  const [form, setForm] = useState({ vehicleId: '', amount: '', expense: '', paymentType: 'Cash', logDate: today(), notes: '' });
  const load = useCallback(() => { api.get('/fleet/cash').then((r) => setData(r.data)).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);
  // Configurable payment types from System Config → Fleet (falls back to Cash/Voucher).
  useEffect(() => {
    api.get('/config').then((r) => {
      const raw = (r.data?.cash_payment_types || '').trim();
      const list = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [];
      const types = list.length ? Array.from(new Set(list)) : ['Cash', 'Voucher'];
      setPayTypes(types);
      setForm((f) => ({ ...f, paymentType: types.includes(f.paymentType) ? f.paymentType : types[0] }));
    }).catch(() => {});
  }, []);
  const submit = async () => {
    if (form.amount === '' || Number(form.amount) < 0) return toast.error('Enter a valid amount');
    if (form.expense !== '' && Number(form.expense) < 0) return toast.error('Expense cannot be negative');
    try { await api.post('/fleet/cash', form); toast.success('Cash submitted'); setForm({ vehicleId: '', amount: '', expense: '', paymentType: payTypes[0] || 'Cash', logDate: today(), notes: '' }); load(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };
  const del = async (c) => { if (!window.confirm('Delete this cash entry?')) return; try { await api.delete(`/fleet/cash/${c.id}`); toast.success('Deleted'); load(); } catch (e) { toast.error(e.response?.data?.error || 'Failed'); } };
  const exportCash = () => {
    if (!data.data.length) return toast.info('No cash entries to export');
    const rows = data.data.map((c) => ({
      Submitted: fmtDT(c.submittedAt),
      'For Date': new Date(c.logDate).toLocaleDateString(),
      Driver: c.driverName || '',
      Vehicle: c.vehicle?.name || '',
      Amount: Number(c.amount || 0),
      Expense: Number(c.expense || 0),
      'Net Total': Number(c.amount || 0) - Number(c.expense || 0),
      'Payment Type': c.paymentType || 'Cash',
      Notes: c.notes || '',
    }));
    exportToXlsx(rows, `fleet-cash-${today()}.xlsx`, 'Cash Log');
  };
  return (
    <Box>
      <Card sx={{ mb: 2 }}><CardContent>
        <Typography variant="subtitle2" gutterBottom>Submit Daily Cash</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField select size="small" label="Vehicle" value={form.vehicleId} onChange={(e) => setForm((f) => ({ ...f, vehicleId: e.target.value }))} sx={{ minWidth: 180 }}>
            <MenuItem value="">— none —</MenuItem>
            {vehicles.map((v) => <MenuItem key={v.id} value={v.id}>{v.name}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Payment Type" value={form.paymentType} onChange={(e) => setForm((f) => ({ ...f, paymentType: e.target.value }))} sx={{ minWidth: 140 }}>
            {payTypes.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
          </TextField>
          <TextField size="small" label="Amount" type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
          <TextField size="small" label="Expense" type="number" value={form.expense} onChange={(e) => setForm((f) => ({ ...f, expense: e.target.value }))} />
          <TextField size="small" label="Net Total" value={SAR((Number(form.amount) || 0) - (Number(form.expense) || 0))} InputProps={{ readOnly: true }} sx={{ minWidth: 120 }} />
          <TextField size="small" type="date" label="Date" value={form.logDate} onChange={(e) => setForm((f) => ({ ...f, logDate: e.target.value }))} InputLabelProps={{ shrink: true }} />
          <TextField size="small" label="Notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} sx={{ flex: 1 }} />
          <Button variant="contained" startIcon={<Paid />} onClick={submit}>Submit</Button>
        </Stack>
      </CardContent></Card>
      <Card>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="subtitle2">Recent Cash Submissions</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="subtitle2" color="primary.main">
              Amount: {SAR(data.totalAmount)} · Expense: {SAR(data.totalExpense)} · Net: {SAR(data.totalNet)}
            </Typography>
            <Button size="small" startIcon={<FileDownload />} onClick={exportCash} disabled={!data.data.length}>Export</Button>
          </Box>
        </Box>
        <Divider />
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead><TableRow sx={{ bgcolor: '#F3F8F5' }}>
              <TableCell><strong>Submitted</strong></TableCell><TableCell><strong>For Date</strong></TableCell><TableCell><strong>Driver</strong></TableCell>
              <TableCell><strong>Vehicle</strong></TableCell><TableCell align="right"><strong>Amount</strong></TableCell>
              <TableCell align="right"><strong>Expense</strong></TableCell><TableCell align="right"><strong>Net Total</strong></TableCell>
              <TableCell><strong>Payment Type</strong></TableCell><TableCell><strong>Notes</strong></TableCell>
              {canDelete && <TableCell align="right"></TableCell>}
            </TableRow></TableHead>
            <TableBody>
              {data.data.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell><Typography variant="caption">{fmtDT(c.submittedAt)}</Typography></TableCell>
                  <TableCell><Typography variant="caption">{new Date(c.logDate).toLocaleDateString()}</Typography></TableCell>
                  <TableCell>{c.driverName || '—'}</TableCell>
                  <TableCell>{c.vehicle?.name || '—'}</TableCell>
                  <TableCell align="right">{SAR(c.amount)}</TableCell>
                  <TableCell align="right">{SAR(c.expense)}</TableCell>
                  <TableCell align="right"><strong>{SAR(Number(c.amount || 0) - Number(c.expense || 0))}</strong></TableCell>
                  <TableCell><Chip size="small" variant="outlined" label={c.paymentType || 'Cash'} /></TableCell>
                  <TableCell><Typography variant="caption">{c.notes || ''}</Typography></TableCell>
                  {canDelete && <TableCell align="right"><Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => del(c)}><Delete fontSize="small" /></IconButton></Tooltip></TableCell>}
                </TableRow>
              ))}
              {data.data.length === 0 && <TableRow><TableCell colSpan={canDelete ? 10 : 9} align="center" sx={{ py: 4, color: 'text.secondary' }}>No cash submissions yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Box>
      </Card>
    </Box>
  );
}

// ── Maintenance ───────────────────────────────────────────────────────────────
function MaintenanceTab({ onChange }) {
  const [alerts, setAlerts] = useState({ vehicles: [], dueCount: 0, soonCount: 0 });
  const [history, setHistory] = useState([]);
  const [dlg, setDlg] = useState(null);
  const [odo, setOdo] = useState('');
  const [file, setFile] = useState(null);
  const readFileAsDataUrl = (f) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(f); });
  const load = useCallback(() => {
    api.get('/fleet/maintenance/alerts').then((r) => setAlerts(r.data)).catch(() => {});
    api.get('/fleet/maintenance').then((r) => setHistory(r.data.data || [])).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  const confirm = async (completed) => {
    try {
      let receiptData, receiptName;
      if (completed) {
        if (!odo || Number(odo) <= 0) return toast.error('Enter the current odo meter reading');
        if (!file) return toast.error('Upload the receipt voucher/invoice as evidence');
        if (file.size > 5 * 1024 * 1024) return toast.error('Receipt file must be under 5 MB');
        receiptData = await readFileAsDataUrl(file);
        receiptName = file.name;
      }
      await api.post('/fleet/maintenance/confirm', { vehicleId: dlg.vehicleId, completed, performedOdometer: odo || undefined, receiptData, receiptName });
      toast.success(completed ? 'Oil change confirmed with receipt' : 'Marked as not done (logged)');
      setDlg(null); setOdo(''); setFile(null); load(); onChange && onChange();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };
  return (
    <Box>
      {alerts.dueCount > 0 && <Alert severity="error" sx={{ mb: 2 }}>{alerts.dueCount} vehicle(s) are due for an oil change — confirm once completed.</Alert>}
      {alerts.dueCount === 0 && alerts.soonCount > 0 && <Alert severity="warning" sx={{ mb: 2 }}>{alerts.soonCount} vehicle(s) approaching their oil-change threshold.</Alert>}
      <Card sx={{ mb: 2 }}>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead><TableRow sx={{ bgcolor: '#F3F8F5' }}>
              <TableCell><strong>Vehicle</strong></TableCell><TableCell align="right"><strong>Odometer</strong></TableCell>
              <TableCell align="right"><strong>Since Last Oil</strong></TableCell><TableCell align="right"><strong>Interval</strong></TableCell>
              <TableCell align="right"><strong>Remaining</strong></TableCell><TableCell><strong>Status</strong></TableCell><TableCell align="right"><strong>Action</strong></TableCell>
            </TableRow></TableHead>
            <TableBody>
              {alerts.vehicles.map((v) => (
                <TableRow key={v.vehicleId} hover>
                  <TableCell>{v.name} <Typography variant="caption" color="text.secondary">{v.plateNumber}</Typography></TableCell>
                  <TableCell align="right">{km(v.currentOdometer)}</TableCell>
                  <TableCell align="right">{km(v.kmSinceOil)}</TableCell>
                  <TableCell align="right">{km(v.intervalKm)}</TableCell>
                  <TableCell align="right" style={{ color: v.kmRemaining <= 0 ? '#C0392B' : v.status === 'SOON' ? '#B8860B' : 'inherit', fontWeight: v.status !== 'OK' ? 700 : 400 }}>{v.kmRemaining <= 0 ? `${km(Math.abs(v.kmRemaining))} over` : km(v.kmRemaining)}</TableCell>
                  <TableCell><Chip size="small" label={(OIL[v.status] || OIL.OK).label} color={(OIL[v.status] || OIL.OK).color} /></TableCell>
                  <TableCell align="right">
                    <Button size="small" variant={v.status === 'DUE' ? 'contained' : 'outlined'} color={v.status === 'DUE' ? 'error' : 'inherit'} startIcon={<Build />} onClick={() => { setDlg(v); setOdo(String(v.currentOdometer || '')); }}>Confirm</Button>
                  </TableCell>
                </TableRow>
              ))}
              {alerts.vehicles.length === 0 && <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>No vehicles. Add vehicles under Transport.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Box>
      </Card>

      <Card>
        <Box sx={{ p: 2 }}><Typography variant="subtitle2">Maintenance History</Typography></Box>
        <Divider />
        <Table size="small">
          <TableHead><TableRow sx={{ bgcolor: '#F3F8F5' }}>
            <TableCell><strong>Date</strong></TableCell><TableCell><strong>Vehicle</strong></TableCell><TableCell><strong>Type</strong></TableCell>
            <TableCell><strong>Status</strong></TableCell><TableCell align="right"><strong>Odometer</strong></TableCell><TableCell><strong>By</strong></TableCell>
          </TableRow></TableHead>
          <TableBody>
            {history.map((h) => (
              <TableRow key={h.id}>
                <TableCell><Typography variant="caption">{fmtDT(h.createdAt)}</Typography></TableCell>
                <TableCell>{h.vehicle?.name || '—'}</TableCell>
                <TableCell>{h.type}</TableCell>
                <TableCell><Chip size="small" label={h.status} color={h.status === 'COMPLETED' ? 'success' : h.status === 'SKIPPED' ? 'default' : 'warning'} /></TableCell>
                <TableCell align="right">{h.performedOdometer ? km(h.performedOdometer) : '—'}</TableCell>
                <TableCell><Typography variant="caption">{h.confirmedByName || '—'}</Typography></TableCell>
              </TableRow>
            ))}
            {history.length === 0 && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>No maintenance records yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!dlg} onClose={() => setDlg(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Oil Change — {dlg?.name}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>Confirm whether the oil change was completed. This is logged either way.</Typography>
          <TextField fullWidth size="small" label="Current Odo Meter at service (km)" type="number" sx={{ mb: 1.5 }} value={odo} onChange={(e) => setOdo(e.target.value)} />
          <Button component="label" variant="outlined" fullWidth size="small">
            {file ? `📎 ${file.name}` : 'Upload Receipt / Invoice (required for Completed)'}
            <input type="file" hidden accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </Button>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => confirm(false)}>Not Done</Button>
          <Button variant="contained" color="success" startIcon={<CheckCircle />} onClick={() => confirm(true)}>Completed</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ── Documents ───────────────────────────────────────────────────────────────
// Per-vehicle compliance document expiry statuses + the "confirm dates valid"
// task. A document is "due" when its expiry is before today.
function DocumentsTab() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    api.get('/fleet/documents').then((r) => setData(r.data.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const confirm = async (v) => {
    try { await api.post(`/fleet/documents/${v.id}/confirm`); toast.success('Documents confirmed'); load(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed to confirm'); }
  };

  const docChip = (d) => {
    if (d.status === 'overdue') return <Chip size="small" color="error" label={`Expired ${fmtD(d.date)}`} />;
    if (d.status === 'soon') return <Chip size="small" color="warning" label={`${fmtD(d.date)} (${d.daysLeft}d)`} />;
    if (d.status === 'missing') return <Chip size="small" variant="outlined" label="Not set" />;
    return <Chip size="small" color="success" variant="outlined" label={fmtD(d.date)} />;
  };

  if (loading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>;
  if (!data.length) return <Alert severity="info">No vehicles to show.</Alert>;

  return (
    <Box>
      {data.map((v) => (
        <Card key={v.id} sx={{ mb: 2, border: v.docReviewPending ? '1px solid #DC2626' : undefined }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
              <Box>
                <Typography fontWeight={700}>{v.name} · {v.plateNumber}</Typography>
                <Typography variant="caption" color="text.secondary">{v.driverName || 'No driver'}</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                {v.docReviewPending
                  ? <Chip size="small" color="error" label="Review pending" />
                  : (v.docsConfirmedAt ? <Chip size="small" color="success" variant="outlined" label={`Confirmed ${fmtDT(v.docsConfirmedAt)}`} /> : <Chip size="small" color="success" variant="outlined" label="All valid" />)}
                {v.docReviewPending && (
                  <Button size="small" variant="contained" startIcon={<CheckCircle />} onClick={() => confirm(v)}>Confirm dates valid</Button>
                )}
              </Box>
            </Box>
            <Grid container spacing={1.5}>
              {v.docs.map((d) => (
                <Grid item xs={6} sm={4} md={3} key={d.key}>
                  <Typography variant="caption" color="text.secondary" display="block">{d.label}</Typography>
                  {docChip(d)}
                </Grid>
              ))}
              <Grid item xs={6} sm={4} md={3}>
                <Typography variant="caption" color="text.secondary" display="block">Nusuk</Typography>
                <Chip size="small" color={v.nusuk ? 'success' : 'warning'} label={v.nusuk ? 'Yes' : 'No'} />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}
