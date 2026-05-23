import React, { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Stack, Button, Chip, Alert, Table, TableHead,
  TableBody, TableRow, TableCell, Card, CardContent, Grid, Divider,
  MenuItem, TextField, CircularProgress,
} from '@mui/material';
import { Refresh, CheckCircle, Warning, Error as ErrorIcon, Hotel } from '@mui/icons-material';
import api from '../services/api';

/*
  Single-page operations console for the platform owner.

  Tells you in plain English what's working and what isn't. No private keys
  are ever exposed — env vars are reported as "set / not set" only.

  Refresh the page or click the Refresh button any time. The whole thing is
  read-only — running it cannot break anything.
*/
const overallColor = { healthy: '#2E9E6B', degraded: '#C9A227', unhealthy: '#C0392B' };

export default function SuperAdminDiagnosticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Hotel seeding
  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState(null);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [diagRes, tenantsRes] = await Promise.all([
        api.get('/super-admin/diagnostics'),
        api.get('/super-admin/tenants?limit=100'),
      ]);
      setData(diagRes.data);
      setTenants(tenantsRes.data.data || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

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

  useEffect(() => { load(); }, []);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="#1B4B35">System Diagnostics</Typography>
          <Typography variant="body2" color="text.secondary">
            One-click health check. Run this first whenever something feels off.
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<Refresh />} onClick={load} disabled={loading}>
          {loading ? 'Running…' : 'Run Again'}
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {data && (
        <>
          <Card sx={{ mb: 3, borderLeft: `6px solid ${overallColor[data.overall]}` }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: overallColor[data.overall], display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  {data.overall === 'healthy' ? <CheckCircle sx={{ fontSize: 32 }} /> :
                   data.overall === 'degraded' ? <Warning sx={{ fontSize: 32 }} /> :
                   <ErrorIcon sx={{ fontSize: 32 }} />}
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={700} sx={{ textTransform: 'capitalize', color: overallColor[data.overall] }}>
                    System is {data.overall}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {data.summary.pass} passing · {data.summary.warn} warnings · {data.summary.fail} failing — checked in {data.elapsedMs} ms
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} md={3}><Card><CardContent>
              <Typography variant="caption" color="text.secondary">Passing</Typography>
              <Typography variant="h4" fontWeight={700} color="#2E9E6B">{data.summary.pass}</Typography>
            </CardContent></Card></Grid>
            <Grid item xs={6} md={3}><Card><CardContent>
              <Typography variant="caption" color="text.secondary">Warnings</Typography>
              <Typography variant="h4" fontWeight={700} color="#C9A227">{data.summary.warn}</Typography>
            </CardContent></Card></Grid>
            <Grid item xs={6} md={3}><Card><CardContent>
              <Typography variant="caption" color="text.secondary">Failing</Typography>
              <Typography variant="h4" fontWeight={700} color="#C0392B">{data.summary.fail}</Typography>
            </CardContent></Card></Grid>
            <Grid item xs={6} md={3}><Card><CardContent>
              <Typography variant="caption" color="text.secondary">Node</Typography>
              <Typography variant="h6" fontWeight={700}>{data.env.NODE_ENV}</Typography>
            </CardContent></Card></Grid>
          </Grid>

          <Paper sx={{ mb: 3, overflow: 'hidden' }}>
            <Box sx={{ p: 2, bgcolor: '#F3F8F5', borderBottom: '1px solid #ddd' }}>
              <Typography variant="h6" fontWeight={700}>Checks</Typography>
            </Box>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell width={120}><strong>Status</strong></TableCell>
                  <TableCell width={220}><strong>Check</strong></TableCell>
                  <TableCell><strong>Detail</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.checks.map((c) => (
                  <TableRow key={c.name}>
                    <TableCell>
                      <Chip
                        size="small"
                        label={c.status.toUpperCase()}
                        color={c.status === 'pass' ? 'success' : c.status === 'warn' ? 'warning' : 'error'}
                      />
                    </TableCell>
                    <TableCell><code style={{ fontSize: '0.85rem' }}>{c.name}</code></TableCell>
                    <TableCell>
                      <Typography variant="body2">{c.detail}</Typography>
                      {c.latencyMs && <Typography variant="caption" color="text.secondary">{c.latencyMs} ms</Typography>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>

          <Paper sx={{ overflow: 'hidden' }}>
            <Box sx={{ p: 2, bgcolor: '#F3F8F5', borderBottom: '1px solid #ddd' }}>
              <Typography variant="h6" fontWeight={700}>Environment</Typography>
              <Typography variant="caption" color="text.secondary">
                Shows whether each variable is set — actual values are never displayed.
              </Typography>
            </Box>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell width={240}><strong>Variable</strong></TableCell>
                  <TableCell width={120}><strong>Status</strong></TableCell>
                  <TableCell><strong>Preview</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.env.flags.map((f) => (
                  <TableRow key={f.name}>
                    <TableCell><code>{f.name}</code></TableCell>
                    <TableCell><Chip size="small" label={f.set ? 'SET' : 'NOT SET'} color={f.set ? 'success' : 'default'} /></TableCell>
                    <TableCell><Typography variant="body2" color="text.secondary">{f.valuePreview || '—'}</Typography></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>

          <Box sx={{ mt: 3 }}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="caption" color="text.secondary">
              Need step-by-step help? Open the TROUBLESHOOTING.md file in the repo for a full runbook covering every common issue.
              Generated at {new Date(data.generatedAt).toLocaleString()}.
            </Typography>
          </Box>
        </>
      )}

      {/* ── Hotel Seed Tool ─────────────────────────────────────────────── */}
      <Paper sx={{ mt: 3, overflow: 'hidden' }}>
        <Box sx={{ p: 2, bgcolor: '#F3F8F5', borderBottom: '1px solid #ddd', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Hotel sx={{ color: '#1B4B35' }} />
          <Box>
            <Typography variant="h6" fontWeight={700}>Seed Hotels</Typography>
            <Typography variant="caption" color="text.secondary">
              Populate a tenant with 44 curated 3★–5★ hotels in Makkah and Madinah (sourced from Booking.com listings).
              Existing hotels are never overwritten.
            </Typography>
          </Box>
        </Box>
        <Box sx={{ p: 3 }}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <TextField
              select label="Select Tenant" value={selectedTenant}
              onChange={(e) => { setSelectedTenant(e.target.value); setSeedResult(null); }}
              sx={{ minWidth: 280 }}
              size="small"
            >
              <MenuItem value="">— choose a tenant —</MenuItem>
              {tenants.map((t) => (
                <MenuItem key={t.id} value={t.id}>{t.name} ({t.slug})</MenuItem>
              ))}
            </TextField>
            <Button
              variant="contained"
              startIcon={seeding ? <CircularProgress size={16} color="inherit" /> : <Hotel />}
              disabled={!selectedTenant || seeding}
              onClick={seedHotels}
              sx={{ bgcolor: '#1B4B35', '&:hover': { bgcolor: '#143d28' } }}
            >
              {seeding ? 'Seeding…' : 'Seed Makkah & Madinah Hotels'}
            </Button>
          </Stack>

          {seedResult && (
            <Alert
              severity={seedResult.ok ? 'success' : 'error'}
              sx={{ mt: 2 }}
            >
              <Typography variant="body2" fontWeight={600}>{seedResult.message}</Typography>
              {seedResult.ok && (
                <Typography variant="caption">
                  Created: {seedResult.created} · Skipped (already exist): {seedResult.skipped} · Total in seed: {seedResult.total}
                  {seedResult.breakdown && ` (Makkah: ${seedResult.breakdown.MAKKAH}, Madinah: ${seedResult.breakdown.MADINAH})`}
                </Typography>
              )}
            </Alert>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
