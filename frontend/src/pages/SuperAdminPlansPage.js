import React, { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Grid, Card, CardContent, Stack, Button, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Switch,
  FormControlLabel, IconButton, Divider, Tooltip,
} from '@mui/material';
import { Edit, Add, Delete } from '@mui/icons-material';
import { toast } from 'react-toastify';
import api from '../services/api';

const planColor = { STARTER: '#4A90D9', GROWTH: '#1B4B35', ENTERPRISE: '#C9A227' };

// All feature flags the system understands. The set is open-ended: type in a
// new key in the dialog and it will be saved into the plan's `features` JSON.
// Add a row here to give it a friendlier UI label + tooltip.
const KNOWN_FEATURES = [
  { key: 'pdfVouchers',    label: 'PDF Vouchers',    help: 'Generate and download branded PDF vouchers for bookings.' },
  { key: 'reports',        label: 'Reports',          help: 'Daily schedule + transport reports, including CSV export.' },
  { key: 'apiAccess',      label: 'API Access',       help: 'Allow tenants to call the REST API directly with their own tokens.' },
  { key: 'customBranding', label: 'Custom Branding',  help: 'Upload logo and pick primary colour for tenant-branded UI/vouchers.' },
];

export default function SuperAdminPlansPage() {
  const [plans, setPlans] = useState([]);
  const [editing, setEditing] = useState(null);
  const [newFeatureKey, setNewFeatureKey] = useState('');

  const load = async () => {
    const res = await api.get('/super-admin/plans');
    setPlans(res.data.data);
  };

  useEffect(() => { load(); }, []);

  const saveEdit = async () => {
    try {
      await api.put(`/super-admin/plans/${editing.plan}`, {
        displayName: editing.displayName,
        description: editing.description,
        defaultMaxUsers: Number(editing.defaultMaxUsers),
        defaultMaxBookings: Number(editing.defaultMaxBookings),
        features: editing.features,
        priceMonthly: editing.priceMonthly === '' ? null : Number(editing.priceMonthly),
        priceCurrency: editing.priceCurrency,
        isActive: editing.isActive,
      });
      toast.success(`Plan ${editing.plan} updated`);
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed');
    }
  };

  const toggleFeature = (key) => {
    setEditing({
      ...editing,
      features: { ...editing.features, [key]: !editing.features[key] },
    });
  };

  const addCustomFeature = () => {
    const key = newFeatureKey.trim();
    if (!key) return;
    setEditing({ ...editing, features: { ...editing.features, [key]: true } });
    setNewFeatureKey('');
  };

  const removeFeature = (key) => {
    const next = { ...editing.features };
    delete next[key];
    setEditing({ ...editing, features: next });
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700} color="#1B4B35">Plan Configuration</Typography>
        <Typography variant="body2" color="text.secondary">
          Edit the limits, features, and pricing for each plan. Changes apply within ~5 seconds —
          no redeploy needed.
        </Typography>
      </Box>

      <Grid container spacing={2}>
        {plans.map((p) => (
          <Grid item xs={12} md={4} key={p.id}>
            <Card sx={{ borderTop: `4px solid ${planColor[p.plan] || '#888'}` }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="h6" fontWeight={700}>{p.displayName}</Typography>
                    <Chip label={p.plan} size="small" sx={{ mt: 0.5 }} />
                  </Box>
                  <IconButton onClick={() => setEditing({ ...p, features: { ...(p.features || {}) } })}>
                    <Edit fontSize="small" />
                  </IconButton>
                </Stack>

                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, minHeight: 40 }}>
                  {p.description || '—'}
                </Typography>

                <Divider sx={{ my: 1.5 }} />

                <Typography variant="h4" fontWeight={700} color={planColor[p.plan]}>
                  {p.priceMonthly != null
                    ? `${p.priceCurrency} ${Number(p.priceMonthly).toFixed(2)}`
                    : 'Free'}
                  <Typography component="span" variant="body2" color="text.secondary">/mo</Typography>
                </Typography>

                <Stack spacing={0.5} sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary">Limits</Typography>
                  <Typography variant="body2">• Up to <strong>{p.defaultMaxUsers}</strong> users</Typography>
                  <Typography variant="body2">• Up to <strong>{p.defaultMaxBookings}</strong> bookings</Typography>
                </Stack>

                <Stack spacing={0.5} sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary">Features</Typography>
                  {Object.entries(p.features || {}).length === 0 && (
                    <Typography variant="body2" color="text.secondary">None configured</Typography>
                  )}
                  {Object.entries(p.features || {}).map(([k, v]) => {
                    const meta = KNOWN_FEATURES.find((f) => f.key === k);
                    return (
                      <Stack key={k} direction="row" alignItems="center" spacing={1}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: v ? '#2E9E6B' : '#C0392B' }} />
                        <Typography variant="body2">{meta?.label || k}</Typography>
                      </Stack>
                    );
                  })}
                </Stack>

                <Divider sx={{ my: 1.5 }} />
                <Typography variant="caption" color="text.secondary">
                  {p.tenantCount} tenant{p.tenantCount === 1 ? '' : 's'} on this plan
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Edit dialog */}
      <Dialog open={!!editing} onClose={() => setEditing(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Plan: {editing?.plan}</DialogTitle>
        <DialogContent>
          {editing && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Display name"
                value={editing.displayName}
                onChange={(e) => setEditing({ ...editing, displayName: e.target.value })}
                fullWidth
              />
              <TextField
                label="Description"
                value={editing.description || ''}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                fullWidth
                multiline
                rows={2}
              />
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Default max users"
                  type="number"
                  value={editing.defaultMaxUsers}
                  onChange={(e) => setEditing({ ...editing, defaultMaxUsers: e.target.value })}
                  fullWidth
                />
                <TextField
                  label="Default max bookings"
                  type="number"
                  value={editing.defaultMaxBookings}
                  onChange={(e) => setEditing({ ...editing, defaultMaxBookings: e.target.value })}
                  fullWidth
                />
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Price / month"
                  type="number"
                  value={editing.priceMonthly ?? ''}
                  onChange={(e) => setEditing({ ...editing, priceMonthly: e.target.value })}
                  fullWidth
                />
                <TextField
                  label="Currency"
                  value={editing.priceCurrency || 'SAR'}
                  onChange={(e) => setEditing({ ...editing, priceCurrency: e.target.value })}
                  sx={{ width: 120 }}
                />
              </Stack>

              <FormControlLabel
                control={
                  <Switch
                    checked={editing.isActive}
                    onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
                  />
                }
                label="Plan is active (offered to new signups)"
              />

              <Divider />
              <Typography variant="subtitle2">Features</Typography>
              <Typography variant="caption" color="text.secondary">
                Toggle which capabilities tenants on this plan have access to.
              </Typography>

              {KNOWN_FEATURES.map((f) => (
                <Tooltip key={f.key} title={f.help} placement="top-start">
                  <FormControlLabel
                    control={
                      <Switch
                        checked={!!editing.features[f.key]}
                        onChange={() => toggleFeature(f.key)}
                      />
                    }
                    label={f.label}
                  />
                </Tooltip>
              ))}

              {/* Custom feature flags not in KNOWN_FEATURES */}
              {Object.keys(editing.features)
                .filter((k) => !KNOWN_FEATURES.find((f) => f.key === k))
                .map((k) => (
                  <Stack direction="row" alignItems="center" key={k}>
                    <FormControlLabel
                      control={<Switch checked={!!editing.features[k]} onChange={() => toggleFeature(k)} />}
                      label={k}
                      sx={{ flexGrow: 1 }}
                    />
                    <IconButton onClick={() => removeFeature(k)} size="small"><Delete fontSize="small" /></IconButton>
                  </Stack>
                ))}

              <Stack direction="row" spacing={1}>
                <TextField
                  label="Add custom feature key"
                  placeholder="e.g. whatsAppIntegration"
                  value={newFeatureKey}
                  onChange={(e) => setNewFeatureKey(e.target.value)}
                  size="small"
                  fullWidth
                />
                <Button onClick={addCustomFeature} startIcon={<Add />}>Add</Button>
              </Stack>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="contained" onClick={saveEdit}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
