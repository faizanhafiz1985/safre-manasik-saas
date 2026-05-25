import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, Switch, CircularProgress, Alert, Snackbar, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Grid, FormControlLabel, LinearProgress,
} from '@mui/material';
import { Refresh, Settings, BarChart } from '@mui/icons-material';
import axios from 'axios';

const api = axios.create({ baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api' });
api.interceptors.request.use((c) => {
  const token = localStorage.getItem('token');
  if (token) c.headers.Authorization = `Bearer ${token}`;
  return c;
});

export default function SuperAdminCrmPage() {
  const [tenants, setTenants] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [configDialog, setConfigDialog] = useState({ open: false, tenant: null, config: null });
  const [configSaving, setConfigSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/super-admin/crm/tenants'),
      api.get('/super-admin/crm/stats'),
    ])
      .then(([t, s]) => {
        setTenants(t.data);
        setStats(s.data);
      })
      .catch(() => setSnackbar({ open: true, message: 'Failed to load CRM data', severity: 'error' }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (tenant, enabled) => {
    try {
      await api.post(`/super-admin/crm/tenants/${tenant.id}/${enabled ? 'enable' : 'disable'}`);
      setTenants((prev) => prev.map((t) => t.id === tenant.id
        ? { ...t, crmConfig: { ...t.crmConfig, enabled } }
        : t
      ));
      setSnackbar({ open: true, message: `CRM ${enabled ? 'enabled' : 'disabled'} for ${tenant.name}`, severity: 'success' });
    } catch (e) {
      setSnackbar({ open: true, message: e.response?.data?.error || 'Failed', severity: 'error' });
    }
  };

  const handleOpenConfig = async (tenant) => {
    try {
      const r = await api.get(`/super-admin/crm/tenants/${tenant.id}/config`);
      setConfigDialog({ open: true, tenant, config: r.data });
    } catch {
      setSnackbar({ open: true, message: 'Failed to load config', severity: 'error' });
    }
  };

  const handleSaveConfig = async () => {
    setConfigSaving(true);
    try {
      await api.put(`/super-admin/crm/tenants/${configDialog.tenant.id}/config`, configDialog.config);
      setSnackbar({ open: true, message: 'Config saved', severity: 'success' });
      setConfigDialog({ open: false, tenant: null, config: null });
      load();
    } catch (e) {
      setSnackbar({ open: true, message: e.response?.data?.error || 'Failed', severity: 'error' });
    } finally { setConfigSaving(false); }
  };

  const setConfig = (key, val) => setConfigDialog((prev) => ({ ...prev, config: { ...prev.config, [key]: val } }));

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="#1B4B35">CRM Management</Typography>
          <Typography variant="body2" color="text.secondary">Enable, configure and monitor CRM per tenant</Typography>
        </Box>
        <Tooltip title="Refresh"><IconButton onClick={load} disabled={loading}><Refresh /></IconButton></Tooltip>
      </Box>

      {/* Platform Stats */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            { label: 'Tenants with CRM', value: stats.enabledTenants, total: stats.totalTenants },
            { label: 'Total Leads', value: stats.totalLeads },
            { label: 'Total Opportunities', value: stats.totalOpportunities },
            { label: 'Total Tasks', value: stats.totalTasks },
          ].map((s) => (
            <Grid item xs={6} md={3} key={s.label}>
              <Card sx={{ borderRadius: 2, p: 2 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>{s.label}</Typography>
                <Typography variant="h4" fontWeight={800} color="#1B4B35">{s.value?.toLocaleString() ?? '—'}</Typography>
                {s.total !== undefined && (
                  <Box>
                    <LinearProgress
                      variant="determinate"
                      value={s.total > 0 ? (s.value / s.total) * 100 : 0}
                      sx={{ height: 4, borderRadius: 2, bgcolor: '#1B4B3520', mt: 0.5, '& .MuiLinearProgress-bar': { bgcolor: '#1B4B35' } }}
                    />
                    <Typography variant="caption" color="text.secondary">of {s.total} tenants</Typography>
                  </Box>
                )}
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Tenant Table */}
      <Card sx={{ borderRadius: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : (
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f8f9fa' }}>
              <TableRow>
                {['Tenant', 'Plan', 'CRM Status', 'Leads', 'Opportunities', 'Tasks', 'Actions'].map((h) => (
                  <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.78rem' }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {tenants.map((t) => {
                const crmEnabled = t.crmConfig?.enabled ?? false;
                return (
                  <TableRow key={t.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700}>{t.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{t.email}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={t.plan || 'BASIC'}
                        size="small"
                        sx={{
                          fontSize: '0.68rem',
                          bgcolor: t.plan === 'ENTERPRISE' ? '#1B4B35' : t.plan === 'GROWTH' ? '#C9A22720' : '#f0f0f0',
                          color: t.plan === 'ENTERPRISE' ? '#fff' : t.plan === 'GROWTH' ? '#C9A227' : 'text.secondary',
                          fontWeight: 700,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Switch
                          size="small"
                          checked={crmEnabled}
                          onChange={(e) => handleToggle(t, e.target.checked)}
                          color="success"
                        />
                        <Chip
                          label={crmEnabled ? 'Enabled' : 'Disabled'}
                          size="small"
                          color={crmEnabled ? 'success' : 'default'}
                          sx={{ fontSize: '0.68rem' }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{t._count?.crmLeads ?? 0}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{t._count?.crmOpportunities ?? 0}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{t._count?.crmTasks ?? 0}</Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Configure CRM">
                        <IconButton size="small" onClick={() => handleOpenConfig(t)} disabled={!crmEnabled}>
                          <Settings fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
              {tenants.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                    No tenants found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Config Dialog */}
      <Dialog open={configDialog.open} onClose={() => setConfigDialog({ open: false, tenant: null, config: null })} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#1B4B35' }}>
          CRM Config — {configDialog.tenant?.name}
        </DialogTitle>
        <DialogContent>
          {configDialog.config && (
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth size="small" label="Max Leads" type="number"
                  value={configDialog.config.maxLeads ?? ''}
                  onChange={(e) => setConfig('maxLeads', e.target.value ? Number(e.target.value) : null)}
                  helperText="Leave blank for unlimited"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth size="small" label="Max Pipelines" type="number"
                  value={configDialog.config.maxPipelines ?? ''}
                  onChange={(e) => setConfig('maxPipelines', e.target.value ? Number(e.target.value) : null)}
                  helperText="Leave blank for unlimited"
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>Features</Typography>
                {[
                  ['whatsappIntegration', 'WhatsApp Integration'],
                  ['facebookIntegration', 'Facebook Integration'],
                  ['instagramIntegration', 'Instagram Integration'],
                  ['automationEngine', 'Automation Engine'],
                  ['advancedReporting', 'Advanced Reporting'],
                ].map(([key, label]) => (
                  <FormControlLabel
                    key={key}
                    control={
                      <Switch
                        size="small"
                        checked={configDialog.config.features?.[key] ?? false}
                        onChange={(e) => setConfig('features', { ...configDialog.config.features, [key]: e.target.checked })}
                        color="success"
                      />
                    }
                    label={<Typography variant="body2">{label}</Typography>}
                    sx={{ display: 'block', mb: 0.5 }}
                  />
                ))}
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfigDialog({ open: false, tenant: null, config: null })} disabled={configSaving}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveConfig} disabled={configSaving}
            sx={{ bgcolor: '#1B4B35', '&:hover': { bgcolor: '#2E6B4F' } }}>
            {configSaving ? <CircularProgress size={18} color="inherit" /> : 'Save Config'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
