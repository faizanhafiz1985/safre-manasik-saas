import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, TextField, Select, MenuItem, FormControl, InputLabel,
  Button, Table, TableHead, TableBody, TableRow, TableCell, Chip, Stack,
  CircularProgress, Card, CardContent, Grid, LinearProgress, Checkbox, Tooltip,
} from '@mui/material';
import { Download, FilterAlt, DirectionsBus, Group, Speed } from '@mui/icons-material';
import api from '../services/api';
import { toast } from 'react-toastify';

const vehicleColors = { BUS: '#1B4B35', CAR: '#4A90D9', VIP: '#C9A227' };
const statusColors  = { CONFIRMED: 'success', TENTATIVE: 'warning', MIXED: 'info', CANCELLED: 'error' };

export default function TransportReportPage() {
  const today = new Date().toISOString().substring(0, 10);
  const endDefault = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(endDefault);
  const [vehicleType, setVehicleType] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { startDate, endDate };
      if (vehicleType) params.vehicleType = vehicleType;
      const { data } = await api.get('/reports/transport-by-date', { params });
      setData(data);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, vehicleType]);

  useEffect(() => { load(); }, [load]);

  // Toggle an operational flag on every assignment within a grouped run.
  const toggleFlag = async (run, field, value) => {
    try {
      await api.patch('/reports/transport-status', { ids: run.transportIds || [], [field]: value });
      setData((prev) => ({
        ...prev,
        runs: prev.runs.map((r) =>
          r === run || (r.transportIds && run.transportIds && r.transportIds.join() === run.transportIds.join())
            ? { ...r, [field]: value, [`${field}Text`]: value ? 'Done' : 'Pending' }
            : r),
      }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    }
  };

  const downloadCsv = () => {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({ startDate, endDate, ...(vehicleType && { vehicleType }) });
    const url = `${api.defaults.baseURL}/reports/transport-by-date/export?${params}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `transport-${startDate}-to-${endDate}.csv`;
        a.click();
      });
  };

  const quickRange = (days) => {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + days);
    setStartDate(start.toISOString().substring(0, 10));
    setEndDate(end.toISOString().substring(0, 10));
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700} color="#1B4B35">Transport Report</Typography>
        <Typography variant="body2" color="text.secondary">
          Fleet utilisation, occupancy, and route schedule across a date range.
        </Typography>
      </Box>

      {/* Summary cards */}
      {data && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} md={3}>
            <Card><CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <DirectionsBus sx={{ color: '#1B4B35' }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">Total Runs</Typography>
                  <Typography variant="h5" fontWeight={700}>{data.summary.totalRuns}</Typography>
                </Box>
              </Box>
            </CardContent></Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card><CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Group sx={{ color: '#4A90D9' }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">Total Passengers</Typography>
                  <Typography variant="h5" fontWeight={700}>{data.summary.totalPassengers}</Typography>
                </Box>
              </Box>
            </CardContent></Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card><CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Speed sx={{ color: '#C9A227' }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">Avg Occupancy</Typography>
                  <Typography variant="h5" fontWeight={700}>{data.summary.avgOccupancyPct}%</Typography>
                </Box>
              </Box>
            </CardContent></Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card><CardContent>
              <Typography variant="caption" color="text.secondary">By Vehicle Type</Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                {Object.entries(data.summary.byVehicleType || {}).map(([t, n]) => (
                  <Chip key={t} label={`${t}: ${n}`} size="small" sx={{ bgcolor: vehicleColors[t], color: '#fff' }} />
                ))}
              </Stack>
            </CardContent></Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <FilterAlt color="primary" />
          <TextField type="date" label="Departure From" value={startDate} onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} size="small" helperText="Filters by departure date" />
          <TextField type="date" label="Departure To" value={endDate} onChange={(e) => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} size="small" />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Vehicle Type</InputLabel>
            <Select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} label="Vehicle Type">
              <MenuItem value="">All</MenuItem>
              <MenuItem value="BUS">Bus</MenuItem>
              <MenuItem value="CAR">Car</MenuItem>
              <MenuItem value="VIP">VIP</MenuItem>
            </Select>
          </FormControl>
          <Stack direction="row" spacing={1}>
            <Button size="small" onClick={() => quickRange(0)}>Today</Button>
            <Button size="small" onClick={() => quickRange(7)}>+7 days</Button>
            <Button size="small" onClick={() => quickRange(31)}>+31 days</Button>
          </Stack>
          <Box sx={{ flex: 1 }} />
          <Button variant="contained" startIcon={<Download />} onClick={downloadCsv} disabled={!data?.runs?.length}>
            Export CSV
          </Button>
        </Stack>
      </Paper>

      {/* Table */}
      <Paper sx={{ overflow: 'hidden' }}>
        {loading && <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress size={24} /></Box>}
        {!loading && (!data?.runs?.length) && (
          <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
            <DirectionsBus sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
            <Typography>No transport runs in this range.</Typography>
          </Box>
        )}
        {!loading && data?.runs?.length > 0 && (
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#F3F8F5' }}>
                <TableCell><strong>Date</strong></TableCell>
                <TableCell><strong>Departure</strong></TableCell>
                <TableCell><strong>Vehicle</strong></TableCell>
                <TableCell><strong>Type</strong></TableCell>
                <TableCell><strong>Driver</strong></TableCell>
                <TableCell><strong>Route</strong></TableCell>
                <TableCell align="center"><strong>Pax</strong></TableCell>
                <TableCell><strong>Occupancy</strong></TableCell>
                <TableCell><strong>Bookings</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell align="center"><strong>Departure Done</strong></TableCell>
                <TableCell align="center"><strong>Transport Availed</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.runs.map((r, idx) => (
                <TableRow key={idx} hover>
                  <TableCell>{r.runDate}</TableCell>
                  <TableCell><strong>{r.departureTime}</strong>{r.arrivalTime && <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>→ {r.arrivalTime}</Typography>}</TableCell>
                  <TableCell><strong>{r.vehicleName}</strong><br/><code>{r.vehiclePlate}</code></TableCell>
                  <TableCell>
                    <Chip label={r.vehicleType} size="small" sx={{ bgcolor: vehicleColors[r.vehicleType], color: '#fff' }} />
                  </TableCell>
                  <TableCell>{r.driverName}<br/><Typography variant="caption" color="text.secondary">{r.driverPhone}</Typography></TableCell>
                  <TableCell>{r.routeFrom} → {r.routeTo}</TableCell>
                  <TableCell align="center">{r.passengerCount}/{r.vehicleCapacity}</TableCell>
                  <TableCell sx={{ minWidth: 120 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ flex: 1 }}>
                        <LinearProgress variant="determinate" value={Math.min(r.occupancyPct, 100)}
                          sx={{ height: 6, borderRadius: 3,
                            bgcolor: '#e0e0e0',
                            '& .MuiLinearProgress-bar': { bgcolor: r.occupancyPct > 80 ? '#C9A227' : r.occupancyPct > 50 ? '#2E9E6B' : '#4A90D9' } }} />
                      </Box>
                      <Typography variant="caption">{r.occupancyPct}%</Typography>
                    </Box>
                  </TableCell>
                  <TableCell><Typography variant="caption">{r.bookingRefs}</Typography></TableCell>
                  <TableCell><Chip label={r.runStatus} size="small" color={statusColors[r.runStatus] || 'default'} /></TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                      <Checkbox size="small" checked={!!r.departureDone}
                        onChange={(e) => toggleFlag(r, 'departureDone', e.target.checked)} />
                      <Chip size="small" label={r.departureDone ? 'Done' : 'Pending'}
                        color={r.departureDone ? 'success' : 'default'} variant={r.departureDone ? 'filled' : 'outlined'} />
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                      <Checkbox size="small" checked={!!r.transportAvailed}
                        onChange={(e) => toggleFlag(r, 'transportAvailed', e.target.checked)} />
                      <Chip size="small" label={r.transportAvailed ? 'Done' : 'Pending'}
                        color={r.transportAvailed ? 'success' : 'default'} variant={r.transportAvailed ? 'filled' : 'outlined'} />
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Box>
  );
}
