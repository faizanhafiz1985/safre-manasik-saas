import React, { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Stack, Button, Chip, Alert, Table, TableHead,
  TableBody, TableRow, TableCell, Card, CardContent, Grid, Divider,
} from '@mui/material';
import { Refresh, CheckCircle, Warning, Error as ErrorIcon } from '@mui/icons-material';
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

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get('/super-admin/diagnostics');
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
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
    </Box>
  );
}
