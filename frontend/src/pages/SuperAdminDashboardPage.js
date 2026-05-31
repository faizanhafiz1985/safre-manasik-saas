// v2 — includes tenant delete
import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Paper, Typography, Grid, Card, CardContent, Table, TableHead,
  TableBody, TableRow, TableCell, Chip, Stack, Button, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, FormControl, InputLabel, Select, MenuItem,
  Tooltip, Alert, CircularProgress, Divider,
} from '@mui/material';
import {
  Business, People, BookOnline, AttachMoney, PauseCircle, PlayCircle, Edit, Delete,
  BugReport, CheckCircle, Warning, Error as ErrorIcon, Refresh, OpenInNew,
  Email, Payment, AdminPanelSettings, HealthAndSafety,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import api from '../services/api';

const statusColor = { ACTIVE: 'success', TRIAL: 'warning', SUSPENDED: 'error', CANCELLED: 'default' };
const planColor   = { STARTER: 'info', GROWTH: 'primary', ENTERPRISE: 'secondary' };

const checkIcon = (status) => {
  if (status === 'pass') return <CheckCircle sx={{ fontSize: 16, color: '#2E9E6B' }} />;
  if (status === 'warn') return <Warning sx={{ fontSize: 16, color: '#C9A227' }} />;
  return <ErrorIcon sx={{ fontSize: 16, color: '#C0392B' }} />;
};

export default function SuperAdminDashboardPage() {
  const [stats, setStats]       = useState(null);
  const [tenants, setTenants]   = useState([]);
  const [editTenant, setEditTenant]     = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [diag, setDiag]                 = useState(null);
  const [diagLoading, setDiagLoading] = useState(false);

  const load = useCallback(async () => {
    const [s, t] = await Promise.all([
      api.get('/super-admin/stats'),
      api.get('/super-admin/tenants'),
    ]);
    setStats(s.data);
    setTenants(t.data.data);
  }, []);

  const loadDiag = useCallback(async () => {
    setDiagLoading(true);
    try {
      const r = await api.get('/super-admin/diagnostics');
      setDiag(r.data);
    } catch { /* silent */ }
    finally { setDiagLoading(false); }
  }, []);

  useEffect(() => { load(); loadDiag(); }, [load, loadDiag]);

  const suspend = async (id) => {
    await api.post(`/super-admin/tenants/${id}/suspend`);
    toast.success('Tenant suspended');
    load();
  };
  const activate = async (id) => {
    await api.post(`/super-admin/tenants/${id}/activate`);
    toast.success('Tenant activated');
    load();
  };
  const saveEdit = async () => {
    await api.put(`/super-admin/tenants/${editTenant.id}`, {
      name: editTenant.name, plan: editTenant.plan, status: editTenant.status,
      maxUsers: Number(editTenant.maxUsers), maxBookings: Number(editTenant.maxBookings),
    });
    toast.success('Tenant updated');
    setEditTenant(null);
    load();
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/super-admin/tenants/${deleteTarget.id}`);
      toast.success(`Tenant "${deleteTarget.name}" and all its data permanently deleted`);
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed');
    }
  };

  if (!stats) return <Box sx={{ p: 4 }}>Loading...</Box>;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700} color="#1B4B35">Platform Administration</Typography>
        <Typography variant="body2" color="text.secondary">
          Manage all tenants on the Safre Manasik SaaS platform.
        </Typography>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total Tenants',    value: stats.stats.totalTenants,     icon: <Business />,   color: '#1B4B35' },
          { label: 'Active',            value: stats.stats.activeTenants,    icon: <PlayCircle />, color: '#2E9E6B' },
          { label: 'Trial',             value: stats.stats.trialTenants,     icon: <Business />,   color: '#C9A227' },
          { label: 'Suspended',         value: stats.stats.suspendedTenants, icon: <PauseCircle />, color: '#C0392B' },
          { label: 'Platform Users',    value: stats.stats.totalUsers,       icon: <People />,     color: '#4A90D9' },
          { label: 'Total Bookings',    value: stats.stats.totalBookings,    icon: <BookOnline />, color: '#1B4B35' },
          { label: 'Platform Revenue',  value: `SAR ${stats.stats.totalRevenue.toLocaleString()}`, icon: <AttachMoney />, color: '#C9A227' },
        ].map((c) => (
          <Grid item xs={6} md={3} key={c.label}>
            <Card sx={{ borderLeft: `4px solid ${c.color}` }}>
              <CardContent sx={{ py: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <Box sx={{ color: c.color }}>{c.icon}</Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">{c.label}</Typography>
                    <Typography variant="h6" fontWeight={700}>{c.value}</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ── Monitoring & Integration Health ─────────────────────────── */}
      <Paper sx={{ mb: 3, overflow: 'hidden' }}>
        <Box sx={{ p: 2, bgcolor: '#F3F8F5', borderBottom: '1px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <HealthAndSafety sx={{ color: '#1B4B35' }} />
            <Typography variant="h6" fontWeight={700}>System Health &amp; Monitoring</Typography>
            {diag && (
              <Chip
                size="small"
                label={diag.overall.toUpperCase()}
                color={diag.overall === 'healthy' ? 'success' : diag.overall === 'degraded' ? 'warning' : 'error'}
              />
            )}
          </Stack>
          <Tooltip title="Refresh diagnostics">
            <IconButton size="small" onClick={loadDiag} disabled={diagLoading}>
              {diagLoading ? <CircularProgress size={16} /> : <Refresh fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>

        {!diag && diagLoading && (
          <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress size={24} /></Box>
        )}

        {diag && (
          <Box sx={{ p: 2 }}>
            {/* Integration status cards */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
              {[
                {
                  key: 'sentry',
                  label: 'Error Monitoring',
                  icon: <BugReport />,
                  check: diag.checks.find((c) => c.name === 'sentry.monitoring'),
                  color: '#8B5CF6',
                  action: process.env.REACT_APP_SENTRY_URL
                    ? { label: 'Open Sentry', url: process.env.REACT_APP_SENTRY_URL }
                    : { label: 'Setup Sentry', url: 'https://sentry.io/signup/' },
                },
                {
                  key: 'email',
                  label: 'Email (SMTP)',
                  icon: <Email />,
                  check: diag.checks.find((c) => c.name === 'email.smtp'),
                  color: '#0EA5E9',
                  action: { label: 'Get Resend', url: 'https://resend.com' },
                },
                {
                  key: 'paypal',
                  label: 'PayPal Gateway',
                  icon: <Payment />,
                  check: diag.checks.find((c) => c.name === 'paypal.platform'),
                  color: '#003087',
                  action: { label: 'PayPal Dev', url: 'https://developer.paypal.com/dashboard' },
                },
                {
                  key: 'db',
                  label: 'Database',
                  icon: <AdminPanelSettings />,
                  check: diag.checks.find((c) => c.name === 'database.connection'),
                  color: '#336791',
                },
              ].map(({ key, label, icon, check, color, action }) => (
                <Grid item xs={12} sm={6} md={3} key={key}>
                  <Card variant="outlined" sx={{ borderLeft: `4px solid ${color}`, height: '100%' }}>
                    <CardContent sx={{ py: 1.5, pb: '12px !important' }}>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                        <Box sx={{ color }}>{icon}</Box>
                        <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase" letterSpacing={0.5}>{label}</Typography>
                      </Stack>
                      {check ? (
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          {checkIcon(check.status)}
                          <Typography variant="body2" fontWeight={600} color={check.status === 'pass' ? '#2E9E6B' : check.status === 'warn' ? '#C9A227' : '#C0392B'}>
                            {check.status === 'pass' ? 'Operational' : check.status === 'warn' ? 'Warning' : 'Failed'}
                          </Typography>
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.secondary">Checking…</Typography>
                      )}
                      {check?.detail && (
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, lineHeight: 1.3 }}>
                          {check.detail}
                        </Typography>
                      )}
                      {action && (
                        <Button
                          size="small"
                          endIcon={<OpenInNew sx={{ fontSize: 12 }} />}
                          href={action.url}
                          target="_blank"
                          rel="noopener"
                          sx={{ mt: 1, p: 0, minWidth: 0, fontSize: 11, color }}
                        >
                          {action.label}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {/* Diagnostics detail */}
            <Divider sx={{ mb: 1.5 }} />
            <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase" letterSpacing={0.5}>
              All Checks ({diag.summary.pass} pass · {diag.summary.warn} warn · {diag.summary.fail} fail) · {diag.elapsedMs}ms
            </Typography>
            <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {diag.checks.map((c) => (
                <Tooltip key={c.name} title={c.detail || ''} arrow>
                  <Chip
                    size="small"
                    icon={checkIcon(c.status)}
                    label={c.name}
                    variant="outlined"
                    sx={{
                      borderColor: c.status === 'pass' ? '#2E9E6B' : c.status === 'warn' ? '#C9A227' : '#C0392B',
                      color: c.status === 'pass' ? '#2E9E6B' : c.status === 'warn' ? '#C9A227' : '#C0392B',
                      fontSize: 11,
                    }}
                  />
                </Tooltip>
              ))}
            </Box>
          </Box>
        )}
      </Paper>

      <Paper sx={{ overflow: 'hidden' }}>
        <Box sx={{ p: 2, bgcolor: '#F3F8F5', borderBottom: '1px solid #ddd' }}>
          <Typography variant="h6" fontWeight={700}>All Tenants</Typography>
        </Box>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>Tenant</strong></TableCell>
              <TableCell><strong>Slug</strong></TableCell>
              <TableCell><strong>Plan</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell align="center"><strong>Users</strong></TableCell>
              <TableCell align="center"><strong>Bookings</strong></TableCell>
              <TableCell align="center"><strong>Packages</strong></TableCell>
              <TableCell><strong>Created</strong></TableCell>
              <TableCell align="right"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tenants.map((t) => (
              <TableRow key={t.id} hover>
                <TableCell>
                  <Typography fontWeight={600}>{t.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{t.contactEmail}</Typography>
                </TableCell>
                <TableCell><code>{t.slug}</code></TableCell>
                <TableCell><Chip label={t.plan} size="small" color={planColor[t.plan]} /></TableCell>
                <TableCell><Chip label={t.status} size="small" color={statusColor[t.status]} /></TableCell>
                <TableCell align="center">{t._count.users}</TableCell>
                <TableCell align="center">{t._count.bookings}</TableCell>
                <TableCell align="center">{t._count.packages}</TableCell>
                <TableCell>{new Date(t.createdAt).toLocaleDateString()}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" title="Edit" onClick={() => setEditTenant({ ...t })}><Edit fontSize="small" /></IconButton>
                  {t.status === 'SUSPENDED' ? (
                    <IconButton size="small" title="Activate" color="success" onClick={() => activate(t.id)}><PlayCircle fontSize="small" /></IconButton>
                  ) : (
                    <IconButton size="small" title="Suspend" color="error" onClick={() => suspend(t.id)}><PauseCircle fontSize="small" /></IconButton>
                  )}
                  <Tooltip title="Delete tenant & all data (irreversible)">
                    <IconButton size="small" color="error" onClick={() => setDeleteTarget(t)}><Delete fontSize="small" /></IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* ── Delete confirmation dialog ───────────────────────────────── */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ color: '#C0392B', fontWeight: 700 }}>Delete Tenant</DialogTitle>
        <DialogContent>
          {deleteTarget && (
            <Stack spacing={1.5}>
              <Alert severity="error">
                This action is <strong>permanent and cannot be undone</strong>.
              </Alert>
              <Typography variant="body2">
                You are about to permanently delete:
              </Typography>
              <Box sx={{ bgcolor: '#FFF4F4', border: '1px solid #FFCDD2', borderRadius: 1, p: 1.5 }}>
                <Typography fontWeight={700}>{deleteTarget.name}</Typography>
                <Typography variant="caption" color="text.secondary">{deleteTarget.slug}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                All users, bookings, packages, hotels, payments, vouchers, and CRM data for this tenant will be permanently deleted.
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" startIcon={<Delete />} onClick={confirmDelete}>
            Delete Permanently
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!editTenant} onClose={() => setEditTenant(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Tenant</DialogTitle>
        <DialogContent>
          {editTenant && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Name" value={editTenant.name} onChange={(e) => setEditTenant({ ...editTenant, name: e.target.value })} fullWidth />
              <FormControl fullWidth>
                <InputLabel>Plan</InputLabel>
                <Select value={editTenant.plan} onChange={(e) => setEditTenant({ ...editTenant, plan: e.target.value })} label="Plan">
                  <MenuItem value="STARTER">Starter</MenuItem>
                  <MenuItem value="GROWTH">Growth</MenuItem>
                  <MenuItem value="ENTERPRISE">Enterprise</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select value={editTenant.status} onChange={(e) => setEditTenant({ ...editTenant, status: e.target.value })} label="Status">
                  <MenuItem value="ACTIVE">Active</MenuItem>
                  <MenuItem value="TRIAL">Trial</MenuItem>
                  <MenuItem value="SUSPENDED">Suspended</MenuItem>
                  <MenuItem value="CANCELLED">Cancelled</MenuItem>
                </Select>
              </FormControl>
              <TextField label="Max Users" type="number" value={editTenant.maxUsers} onChange={(e) => setEditTenant({ ...editTenant, maxUsers: e.target.value })} fullWidth />
              <TextField label="Max Bookings" type="number" value={editTenant.maxBookings} onChange={(e) => setEditTenant({ ...editTenant, maxBookings: e.target.value })} fullWidth />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditTenant(null)}>Cancel</Button>
          <Button variant="contained" onClick={saveEdit}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
