import React, { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  Chip, Stack, Button, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, ToggleButton, ToggleButtonGroup, Card, CardContent, Grid, Alert,
} from '@mui/material';
import { CheckCircle, Cancel, Visibility } from '@mui/icons-material';
import { toast } from 'react-toastify';
import api from '../services/api';

/*
  Tenant Applications queue for SUPER_ADMIN.

  Approving creates the Tenant + ADMIN user atomically and emails the applicant
  a welcome message. Rejecting records the reason and emails the applicant.
  Status filter lets you focus on PENDING (the actionable queue) or browse
  history.
*/
const statusColor = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'error' };

export default function SuperAdminApplicationsPage() {
  const [apps, setApps] = useState([]);
  const [summary, setSummary] = useState({ PENDING: 0, APPROVED: 0, REJECTED: 0 });
  const [filter, setFilter] = useState('PENDING');
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(null);   // application being approved
  const [rejecting, setRejecting] = useState(null);   // application being rejected
  const [rejectReason, setRejectReason] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');

  const load = async () => {
    const { data } = await api.get('/super-admin/applications', { params: { status: filter || undefined } });
    setApps(data.data);
    setSummary(data.summary);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const approve = async () => {
    if (!reviewing) return;
    setBusy(true);
    try {
      await api.post(`/super-admin/applications/${reviewing.id}/approve`, { notes: reviewNotes });
      toast.success(`Approved ${reviewing.tenantName}. Welcome email sent.`);
      setReviewing(null);
      setReviewNotes('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Approval failed');
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!rejecting) return;
    if (!rejectReason.trim()) {
      toast.error('Please provide a rejection reason — the applicant will see it.');
      return;
    }
    setBusy(true);
    try {
      await api.post(`/super-admin/applications/${rejecting.id}/reject`, { reason: rejectReason });
      toast.info(`Rejected ${rejecting.tenantName}. Email sent.`);
      setRejecting(null);
      setRejectReason('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Rejection failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700} color="#1B4B35">Tenant Applications</Typography>
        <Typography variant="body2" color="text.secondary">
          Approve or reject new agency signups. Each approval creates the tenant + admin user and emails the applicant.
        </Typography>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { key: 'PENDING',  label: 'Pending review', color: '#C9A227' },
          { key: 'APPROVED', label: 'Approved',       color: '#2E9E6B' },
          { key: 'REJECTED', label: 'Rejected',       color: '#C0392B' },
        ].map((s) => (
          <Grid item xs={12} sm={4} key={s.key}>
            <Card sx={{ borderLeft: `4px solid ${s.color}`, cursor: 'pointer' }} onClick={() => setFilter(s.key)}>
              <CardContent>
                <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                <Typography variant="h4" fontWeight={700} color={s.color}>{summary[s.key] || 0}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={filter}
          onChange={(_, v) => v && setFilter(v)}
        >
          <ToggleButton value="PENDING">Pending</ToggleButton>
          <ToggleButton value="APPROVED">Approved</ToggleButton>
          <ToggleButton value="REJECTED">Rejected</ToggleButton>
          <ToggleButton value="">All</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <Paper sx={{ overflow: 'hidden' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>Organisation</strong></TableCell>
              <TableCell><strong>Admin</strong></TableCell>
              <TableCell><strong>Country</strong></TableCell>
              <TableCell><strong>Phone</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell><strong>Submitted</strong></TableCell>
              <TableCell align="right"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {apps.length === 0 && (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                No applications {filter ? `with status ${filter}` : ''}.
              </TableCell></TableRow>
            )}
            {apps.map((a) => (
              <TableRow key={a.id} hover>
                <TableCell>
                  <Typography fontWeight={600}>{a.tenantName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {a.crNumber ? `CR ${a.crNumber}` : ''}{a.vatNumber ? ` · VAT ${a.vatNumber}` : ''}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{a.adminName}</Typography>
                  <Typography variant="caption" color="text.secondary">{a.adminEmail}</Typography>
                </TableCell>
                <TableCell>{a.country || '—'}{a.city ? ` · ${a.city}` : ''}</TableCell>
                <TableCell><Typography variant="body2"><code>{a.contactPhone || '—'}</code></Typography></TableCell>
                <TableCell><Chip label={a.status} size="small" color={statusColor[a.status]} /></TableCell>
                <TableCell>{new Date(a.createdAt).toLocaleDateString()}</TableCell>
                <TableCell align="right">
                  {a.status === 'PENDING' ? (
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Button size="small" color="success" startIcon={<CheckCircle />} onClick={() => setReviewing(a)}>
                        Approve
                      </Button>
                      <Button size="small" color="error" startIcon={<Cancel />} onClick={() => setRejecting(a)}>
                        Reject
                      </Button>
                    </Stack>
                  ) : (
                    <IconButton size="small" onClick={() => setReviewing(a)}><Visibility fontSize="small" /></IconButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* Approve / view dialog */}
      <Dialog open={!!reviewing} onClose={() => setReviewing(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {reviewing?.status === 'PENDING' ? 'Approve application' : `Application — ${reviewing?.status}`}
        </DialogTitle>
        <DialogContent>
          {reviewing && (
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              <Box><strong>{reviewing.tenantName}</strong></Box>
              <Box>Admin: {reviewing.adminName} &lt;{reviewing.adminEmail}&gt;</Box>
              <Box>Phone: {reviewing.contactPhone || '—'}</Box>
              <Box>Country / City: {reviewing.country || '—'} / {reviewing.city || '—'}</Box>
              <Box>CR / VAT: {reviewing.crNumber || '—'} / {reviewing.vatNumber || '—'}</Box>
              <Box>Umrah Licence: {reviewing.umrahLicenseNumber || '—'}</Box>
              {reviewing.status === 'PENDING' && (
                <>
                  <Alert severity="info">
                    Approving will <strong>create the tenant + admin user</strong> and email a welcome message to {reviewing.adminEmail}.
                  </Alert>
                  <TextField
                    label="Internal notes (optional)"
                    multiline rows={2} value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Anything you want recorded for audit (not shared with applicant)"
                  />
                </>
              )}
              {reviewing.rejectionReason && (
                <Alert severity="error"><strong>Rejection reason:</strong> {reviewing.rejectionReason}</Alert>
              )}
              {reviewing.reviewNotes && (
                <Alert severity="info"><strong>Reviewer notes:</strong> {reviewing.reviewNotes}</Alert>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewing(null)}>Close</Button>
          {reviewing?.status === 'PENDING' && (
            <Button variant="contained" color="success" onClick={approve} disabled={busy}>
              {busy ? 'Approving…' : 'Approve & Create Tenant'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejecting} onClose={() => setRejecting(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Reject application</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Reject the application from <strong>{rejecting?.tenantName}</strong> ({rejecting?.adminEmail}).
            The applicant will receive the reason by email.
          </Typography>
          <TextField
            fullWidth
            multiline rows={3}
            label="Reason for rejection *"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. We were unable to verify your CR number with the Ministry of Commerce."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejecting(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={reject} disabled={busy || !rejectReason.trim()}>
            {busy ? 'Rejecting…' : 'Reject & Notify'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
