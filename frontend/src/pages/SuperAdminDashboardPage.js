import React, { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Grid, Card, CardContent, Table, TableHead,
  TableBody, TableRow, TableCell, Chip, Stack, Button, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import { Business, People, BookOnline, AttachMoney, PauseCircle, PlayCircle, Edit, Visibility } from '@mui/icons-material';
import { toast } from 'react-toastify';
import api from '../services/api';

const statusColor = { ACTIVE: 'success', TRIAL: 'warning', SUSPENDED: 'error', CANCELLED: 'default' };
const planColor   = { STARTER: 'info', GROWTH: 'primary', ENTERPRISE: 'secondary' };

export default function SuperAdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [editTenant, setEditTenant] = useState(null);

  const load = async () => {
    const [s, t] = await Promise.all([
      api.get('/super-admin/stats'),
      api.get('/super-admin/tenants'),
    ]);
    setStats(s.data);
    setTenants(t.data.data);
  };

  useEffect(() => { load(); }, []);

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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

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
