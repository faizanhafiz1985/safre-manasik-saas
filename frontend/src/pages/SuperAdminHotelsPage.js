import React, { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Stack, Button, Alert, MenuItem, TextField,
  CircularProgress, Card, CardContent, Grid, Divider,
} from '@mui/material';
import { Hotel, CheckCircle } from '@mui/icons-material';
import api from '../services/api';

/*
  Super-admin one-click hotel seeder.
  Populates a tenant's hotel catalogue with 44 curated 3★–5★ hotels in
  Makkah and Madinah. Safe to run repeatedly — existing hotels are never
  overwritten.
*/
export default function SuperAdminHotelsPage() {
  const [tenants, setTenants] = useState([]);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/super-admin/tenants?limit=100')
      .then(res => setTenants(res.data.data || []))
      .catch(err => setError(err.response?.data?.error || 'Failed to load tenants'))
      .finally(() => setLoadingTenants(false));
  }, []);

  const seedHotels = async () => {
    if (!selectedTenant) return;
    setSeeding(true); setSeedResult(null);
    try {
      const res = await api.post('/super-admin/seed-hotels', { tenantId: selectedTenant });
      setSeedResult({ ok: true, ...res.data });
    } catch (err) {
      setSeedResult({ ok: false, message: err.response?.data?.error || 'Seed failed' });
    } finally {
      setSeeding(false);
    }
  };

  const selectedTenantObj = tenants.find(t => t.id === selectedTenant);

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="#1B4B35">Seed Hotels</Typography>
          <Typography variant="body2" color="text.secondary">
            One-click hotel catalogue seeder — 44 curated hotels across Makkah & Madinah.
          </Typography>
        </Box>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Info Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">Total Hotels</Typography>
              <Typography variant="h4" fontWeight={700} color="#1B4B35">44</Typography>
              <Typography variant="caption" color="text.secondary">Curated 3★ – 5★ properties</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">Makkah</Typography>
              <Typography variant="h4" fontWeight={700} color="#C9A227">24</Typography>
              <Typography variant="caption" color="text.secondary">Near Al-Masjid Al-Haram</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">Madinah</Typography>
              <Typography variant="h4" fontWeight={700} color="#4A90D9">20</Typography>
              <Typography variant="caption" color="text.secondary">Near Al-Masjid An-Nabawi</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Seed Tool */}
      <Paper sx={{ overflow: 'hidden' }}>
        <Box sx={{ p: 2, bgcolor: '#F3F8F5', borderBottom: '1px solid #ddd', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Hotel sx={{ color: '#1B4B35' }} />
          <Box>
            <Typography variant="h6" fontWeight={700}>Select Tenant & Seed</Typography>
            <Typography variant="caption" color="text.secondary">
              Choose the tenant whose hotel catalogue you want to populate. Existing hotels are never overwritten.
            </Typography>
          </Box>
        </Box>

        <Box sx={{ p: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} flexWrap="wrap">
            <TextField
              select
              label="Select Tenant"
              value={selectedTenant}
              onChange={(e) => { setSelectedTenant(e.target.value); setSeedResult(null); }}
              sx={{ minWidth: 300 }}
              size="small"
              disabled={loadingTenants}
            >
              <MenuItem value="">— choose a tenant —</MenuItem>
              {tenants.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name} <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>({t.slug})</Typography>
                </MenuItem>
              ))}
            </TextField>

            <Button
              variant="contained"
              size="medium"
              startIcon={seeding ? <CircularProgress size={16} color="inherit" /> : <Hotel />}
              disabled={!selectedTenant || seeding}
              onClick={seedHotels}
              sx={{ bgcolor: '#1B4B35', '&:hover': { bgcolor: '#143d28' }, minWidth: 240 }}
            >
              {seeding ? 'Seeding…' : 'Seed Makkah & Madinah Hotels'}
            </Button>
          </Stack>

          {selectedTenantObj && !seedResult && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
              Will seed hotels into: <strong>{selectedTenantObj.name}</strong> ({selectedTenantObj.slug})
            </Typography>
          )}

          {seedResult && (
            <Alert
              severity={seedResult.ok ? 'success' : 'error'}
              sx={{ mt: 2 }}
              icon={seedResult.ok ? <CheckCircle /> : undefined}
            >
              <Typography variant="body2" fontWeight={600}>{seedResult.message}</Typography>
              {seedResult.ok && (
                <Box sx={{ mt: 0.5 }}>
                  <Typography variant="caption" display="block">
                    ✅ Created: <strong>{seedResult.created}</strong> new hotels
                  </Typography>
                  <Typography variant="caption" display="block">
                    ⏭ Skipped (already exist): <strong>{seedResult.skipped}</strong>
                  </Typography>
                  <Typography variant="caption" display="block">
                    📊 Total in seed catalogue: <strong>{seedResult.total}</strong>
                    {seedResult.breakdown && ` — Makkah: ${seedResult.breakdown.MAKKAH}, Madinah: ${seedResult.breakdown.MADINAH}`}
                  </Typography>
                </Box>
              )}
            </Alert>
          )}
        </Box>
      </Paper>

      <Divider sx={{ my: 3 }} />

      {/* Notes */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Notes</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          • <strong>Safe to run multiple times</strong> — hotels that already exist (matched by name) are skipped automatically.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          • Hotels include distance to Haram, star rating, city, address, and amenities.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          • After seeding, the tenant's agents can view hotels under <strong>Hotels</strong> in their sidebar.
        </Typography>
      </Paper>
    </Box>
  );
}
