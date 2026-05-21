import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, TextField, Select, MenuItem, FormControl, InputLabel,
  Button, Table, TableHead, TableBody, TableRow, TableCell, Chip, Stack,
  CircularProgress, Card, CardContent, Grid,
} from '@mui/material';
import { Download, FilterAlt, EventNote, Login, Logout, DirectionsBus } from '@mui/icons-material';
import api from '../services/api';

const eventColors = {
  'CHECK-IN': '#2E9E6B',
  'CHECK-OUT': '#C9A227',
  'TRANSPORT': '#4A90D9',
};

export default function DailySchedulePage() {
  const today = new Date().toISOString().substring(0, 10);
  const [date, setDate] = useState(today);
  const [eventType, setEventType] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { date };
      if (eventType !== 'ALL') params.eventType = eventType;
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/reports/daily-schedule', { params });
      setData(data);
    } finally {
      setLoading(false);
    }
  }, [date, eventType, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const downloadCsv = () => {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({ date, ...(eventType !== 'ALL' && { eventType }), ...(statusFilter && { status: statusFilter }) });
    const url = `${api.defaults.baseURL}/reports/daily-schedule/export?${params}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `daily-schedule-${date}.csv`;
        a.click();
      });
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700} color="#1B4B35">Daily Schedule</Typography>
        <Typography variant="body2" color="text.secondary">
          Combined view of hotel check-ins, check-outs, and transport runs for a given day.
        </Typography>
      </Box>

      {/* Summary cards */}
      {data && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            { label: 'Check-Ins',  value: data.summary.checkIns, icon: <Login />, color: eventColors['CHECK-IN'] },
            { label: 'Check-Outs', value: data.summary.checkOuts, icon: <Logout />, color: eventColors['CHECK-OUT'] },
            { label: 'Transport Runs', value: data.summary.transports, icon: <DirectionsBus />, color: eventColors['TRANSPORT'] },
            { label: 'Total Events', value: data.totalEvents, icon: <EventNote />, color: '#1B4B35' },
          ].map((c) => (
            <Grid item xs={6} md={3} key={c.label}>
              <Card sx={{ borderLeft: `4px solid ${c.color}` }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ color: c.color }}>{c.icon}</Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">{c.label}</Typography>
                      <Typography variant="h5" fontWeight={700}>{c.value}</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <FilterAlt color="primary" />
          <TextField type="date" label="Date" value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} size="small" />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Event Type</InputLabel>
            <Select value={eventType} onChange={(e) => setEventType(e.target.value)} label="Event Type">
              <MenuItem value="ALL">All</MenuItem>
              <MenuItem value="CHECK-IN">Check-In</MenuItem>
              <MenuItem value="CHECK-OUT">Check-Out</MenuItem>
              <MenuItem value="TRANSPORT">Transport</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Status</InputLabel>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} label="Status">
              <MenuItem value="">All</MenuItem>
              <MenuItem value="CONFIRMED">Confirmed</MenuItem>
              <MenuItem value="TENTATIVE">Tentative</MenuItem>
            </Select>
          </FormControl>
          <Box sx={{ flex: 1 }} />
          <Button variant="contained" startIcon={<Download />} onClick={downloadCsv} disabled={!data?.events?.length}>
            Export CSV
          </Button>
        </Stack>
      </Paper>

      {/* Table */}
      <Paper sx={{ overflow: 'hidden' }}>
        {loading && <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress size={24} /></Box>}
        {!loading && (!data?.events?.length) && (
          <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
            <EventNote sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
            <Typography>No events found for {date}.</Typography>
          </Box>
        )}
        {!loading && data?.events?.length > 0 && (
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#F3F8F5' }}>
                <TableCell><strong>Event</strong></TableCell>
                <TableCell><strong>Time</strong></TableCell>
                <TableCell><strong>Booking</strong></TableCell>
                <TableCell><strong>Customer</strong></TableCell>
                <TableCell align="center"><strong>Pax</strong></TableCell>
                <TableCell><strong>Hotel</strong></TableCell>
                <TableCell><strong>Vehicle</strong></TableCell>
                <TableCell><strong>Route</strong></TableCell>
                <TableCell><strong>Driver</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.events.map((ev, idx) => (
                <TableRow key={idx} hover>
                  <TableCell>
                    <Chip label={ev.eventType} size="small"
                      sx={{ bgcolor: eventColors[ev.eventType], color: '#fff', fontWeight: 700 }} />
                  </TableCell>
                  <TableCell><strong>{ev.time}</strong></TableCell>
                  <TableCell><code>{ev.bookingRef}</code></TableCell>
                  <TableCell>{ev.customerName}</TableCell>
                  <TableCell align="center">{ev.paxCount}</TableCell>
                  <TableCell>{ev.hotelName ? `${ev.hotelName} (${ev.hotelCity})` : '—'}</TableCell>
                  <TableCell>{ev.vehicle || '—'}</TableCell>
                  <TableCell>{ev.route || '—'}</TableCell>
                  <TableCell>{ev.driver || '—'}</TableCell>
                  <TableCell>
                    <Chip label={ev.status} size="small"
                      color={ev.status === 'CONFIRMED' ? 'success' : ev.status === 'TENTATIVE' ? 'warning' : 'default'} />
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
