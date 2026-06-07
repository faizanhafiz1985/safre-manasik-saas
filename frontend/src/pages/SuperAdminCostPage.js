import React, { useEffect, useState, useCallback, Fragment } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Table, TableHead, TableBody, TableRow,
  TableCell, Chip, Button, IconButton, Tooltip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, CircularProgress, Collapse, Link,
} from '@mui/material';
import {
  Paid, Add, Edit, Delete, Download, Print, ExpandMore, ExpandLess,
  AccountBalanceWallet, EventBusy, Schedule, OpenInNew,
} from '@mui/icons-material';
import api from '../services/api';
import { toast } from 'react-toastify';

const STATUS = {
  OVERDUE:  { label: 'Overdue',  color: 'error' },
  DUE_SOON: { label: 'Due Soon', color: 'warning' },
  PAID:     { label: 'Paid',     color: 'success' },
  PENDING:  { label: 'Pending',  color: 'default' },
  USAGE:    { label: 'Usage-based', color: 'default' },
};
const CYCLES = ['MONTHLY', 'YEARLY', 'ONE_TIME', 'USAGE'];
const money = (n, c = 'USD') => `${c} ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');
const EMPTY = { name: '', category: '', url: '', monthlyCost: 0, currency: 'USD', billingCycle: 'MONTHLY', nextDueDate: '', notes: '' };

export default function SuperAdminCostPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payDialog, setPayDialog] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', method: 'CARD', reference: '' });
  const [editDialog, setEditDialog] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [expanded, setExpanded] = useState(null);
  const [history, setHistory] = useState({});

  const load = useCallback(() => {
    setLoading(true);
    api.get('/super-admin/costs')
      .then((r) => setData(r.data))
      .catch((e) => toast.error(e.response?.data?.error || 'Failed to load costs'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditId(null); setForm(EMPTY); setEditDialog(true); };
  const openEdit = (p) => {
    setEditId(p.id);
    setForm({
      name: p.name || '', category: p.category || '', url: p.url || '',
      monthlyCost: p.monthlyCost ?? 0, currency: p.currency || 'USD',
      billingCycle: p.billingCycle || 'MONTHLY',
      nextDueDate: p.nextDueDate ? String(p.nextDueDate).substring(0, 10) : '',
      notes: p.notes || '',
    });
    setEditDialog(true);
  };
  const save = async () => {
    if (!form.name.trim()) return toast.error('Platform name is required');
    try {
      if (editId) await api.put(`/super-admin/costs/${editId}`, form);
      else await api.post('/super-admin/costs', form);
      toast.success(editId ? 'Platform updated' : 'Platform added');
      setEditDialog(false); load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to save'); }
  };
  const del = async (p) => {
    if (!window.confirm(`Remove ${p.name} from cost tracking?`)) return;
    try { await api.delete(`/super-admin/costs/${p.id}`); toast.success('Removed'); load(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed to remove'); }
  };
  const openPay = (p) => { setPayDialog(p); setPayForm({ amount: p.monthlyCost ?? '', method: 'CARD', reference: '' }); };
  const recordPay = async () => {
    try {
      await api.post(`/super-admin/costs/${payDialog.id}/pay`, payForm);
      toast.success(`Payment recorded for ${payDialog.name}`);
      setPayDialog(null); load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to record payment'); }
  };
  const toggleHistory = async (p) => {
    if (expanded === p.id) { setExpanded(null); return; }
    setExpanded(p.id);
    if (!history[p.id]) {
      try { const r = await api.get(`/super-admin/costs/${p.id}/payments?months=6`); setHistory((h) => ({ ...h, [p.id]: r.data })); }
      catch { setHistory((h) => ({ ...h, [p.id]: [] })); }
    }
  };
  const exportCsv = () => {
    const token = localStorage.getItem('token');
    fetch(`${api.defaults.baseURL}/super-admin/costs/export`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `platform-costs-${new Date().toISOString().substring(0, 10)}.csv`;
        a.click();
      })
      .catch(() => toast.error('Export failed'));
  };

  if (loading) return <Box sx={{ textAlign: 'center', mt: 8 }}><CircularProgress /></Box>;
  const ov = data?.overview || {};
  const rows = data?.platforms || [];

  const cards = [
    { label: 'Total Monthly Cost', value: money(ov.totalMonthly), sub: `${ov.activeServices || 0} active services`, icon: <AccountBalanceWallet />, color: '#1B4B35' },
    { label: 'Due Within 30 Days', value: money(ov.dueSoon?.amount), sub: `${ov.dueSoon?.count || 0} payment(s)`, icon: <Schedule />, color: '#C9A227' },
    { label: 'Overdue', value: money(ov.overdue?.amount), sub: `${ov.overdue?.count || 0} payment(s)`, icon: <EventBusy />, color: ov.overdue?.count ? '#C0392B' : '#94a3b8' },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="#1B4B35">Cost Monitor</Typography>
          <Typography variant="body2" color="text.secondary">Track platform subscription costs, due dates and payment status to prevent service disruption.</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button startIcon={<Download />} onClick={exportCsv} variant="outlined">Export CSV</Button>
          <Button startIcon={<Print />} onClick={() => window.print()} variant="outlined">Print / PDF</Button>
          <Button startIcon={<Add />} onClick={openAdd} variant="contained">Add Platform</Button>
        </Box>
      </Box>

      {/* Overview cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {cards.map((c) => (
          <Grid item xs={12} md={4} key={c.label}>
            <Card sx={{ borderLeft: `4px solid ${c.color}` }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ color: c.color }}>{c.icon}</Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">{c.label}</Typography>
                  <Typography variant="h5" fontWeight={700}>{c.value}</Typography>
                  <Typography variant="caption" color="text.secondary">{c.sub}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      {ov.byCurrency && Object.keys(ov.byCurrency).length > 1 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Monthly by currency: {Object.entries(ov.byCurrency).map(([c, v]) => `${money(v, c)}`).join('  ·  ')}
        </Typography>
      )}

      {/* Platform table */}
      <Card>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#F3F8F5' }}>
                <TableCell width={40} />
                <TableCell><strong>Platform</strong></TableCell>
                <TableCell><strong>Monthly Cost</strong></TableCell>
                <TableCell><strong>Cycle</strong></TableCell>
                <TableCell><strong>Due Date</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell><strong>Last Payment</strong></TableCell>
                <TableCell align="right"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((p) => {
                const st = STATUS[p.status] || STATUS.PENDING;
                return (
                  <Fragment key={p.id}>
                    <TableRow hover sx={{ opacity: p.isActive ? 1 : 0.55 }}>
                      <TableCell>
                        <IconButton size="small" onClick={() => toggleHistory(p)}>
                          {expanded === p.id ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{p.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {p.category || '—'}{p.url ? <> · <Link href={p.url} target="_blank" rel="noopener" underline="hover">site<OpenInNew sx={{ fontSize: 11, ml: 0.2, verticalAlign: 'middle' }} /></Link></> : null}
                        </Typography>
                      </TableCell>
                      <TableCell>{money(p.monthlyCost, p.currency)}</TableCell>
                      <TableCell><Typography variant="caption">{p.billingCycle}</Typography></TableCell>
                      <TableCell>
                        <Typography variant="body2"
                          sx={{ fontWeight: p.dueSoon || p.status === 'OVERDUE' ? 700 : 400,
                                color: p.status === 'OVERDUE' ? 'error.main' : p.dueSoon ? '#B8860B' : 'inherit' }}>
                          {fmtDate(p.nextDueDate)}
                        </Typography>
                        {p.daysUntilDue !== null && p.billingCycle !== 'USAGE' && (
                          <Typography variant="caption" color="text.secondary">
                            {p.daysUntilDue < 0 ? `${Math.abs(p.daysUntilDue)}d overdue` : `in ${p.daysUntilDue}d`}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell><Chip size="small" label={st.label} color={st.color} variant={st.color === 'default' ? 'outlined' : 'filled'} /></TableCell>
                      <TableCell><Typography variant="caption">{fmtDate(p.lastPaymentDate)}</Typography></TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                          {p.billingCycle !== 'USAGE' && (
                            <Tooltip title="Mark as paid"><IconButton size="small" color="success" onClick={() => openPay(p)}><Paid fontSize="small" /></IconButton></Tooltip>
                          )}
                          <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(p)}><Edit fontSize="small" /></IconButton></Tooltip>
                          <Tooltip title="Remove"><IconButton size="small" color="error" onClick={() => del(p)}><Delete fontSize="small" /></IconButton></Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={8} sx={{ py: 0, border: 0 }}>
                        <Collapse in={expanded === p.id} unmountOnExit>
                          <Box sx={{ p: 2, bgcolor: '#fafafa' }}>
                            <Typography variant="subtitle2" gutterBottom>Payment history — last 6 months</Typography>
                            {!history[p.id] ? <CircularProgress size={18} /> : history[p.id].length === 0 ? (
                              <Typography variant="caption" color="text.secondary">No payments recorded in the last 6 months.</Typography>
                            ) : (
                              <Table size="small">
                                <TableHead><TableRow>
                                  <TableCell>Date</TableCell><TableCell>Period</TableCell><TableCell>Amount</TableCell><TableCell>Method</TableCell><TableCell>Reference</TableCell>
                                </TableRow></TableHead>
                                <TableBody>
                                  {history[p.id].map((h) => (
                                    <TableRow key={h.id}>
                                      <TableCell>{fmtDate(h.paidAt)}</TableCell>
                                      <TableCell>{h.periodLabel || '—'}</TableCell>
                                      <TableCell>{money(h.amount, h.currency)}</TableCell>
                                      <TableCell>{h.method || '—'}</TableCell>
                                      <TableCell>{h.reference || '—'}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </Fragment>
                );
              })}
              {rows.length === 0 && <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>No platforms tracked yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Box>
      </Card>

      {/* Mark-paid dialog */}
      <Dialog open={!!payDialog} onClose={() => setPayDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Record Payment — {payDialog?.name}</DialogTitle>
        <DialogContent>
          <TextField fullWidth size="small" label="Amount" type="number" sx={{ mt: 1, mb: 2 }}
            value={payForm.amount} onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))} />
          <TextField select fullWidth size="small" label="Method" sx={{ mb: 2 }}
            value={payForm.method} onChange={(e) => setPayForm((f) => ({ ...f, method: e.target.value }))}>
            {['CARD', 'BANK_TRANSFER', 'PAYPAL', 'CASH', 'OTHER'].map((m) => <MenuItem key={m} value={m}>{m.replace('_', ' ')}</MenuItem>)}
          </TextField>
          <TextField fullWidth size="small" label="Reference (optional)"
            value={payForm.reference} onChange={(e) => setPayForm((f) => ({ ...f, reference: e.target.value }))} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPayDialog(null)}>Cancel</Button>
          <Button variant="contained" color="success" startIcon={<Paid />} onClick={recordPay}>Mark as Paid</Button>
        </DialogActions>
      </Dialog>

      {/* Add / edit dialog */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editId ? 'Edit Platform' : 'Add Platform'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Platform name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Category" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Monthly cost" type="number" value={form.monthlyCost} onChange={(e) => setForm((f) => ({ ...f, monthlyCost: e.target.value }))} /></Grid>
            <Grid item xs={6} sm={3}><TextField fullWidth size="small" label="Currency" value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} /></Grid>
            <Grid item xs={6} sm={3}>
              <TextField select fullWidth size="small" label="Cycle" value={form.billingCycle} onChange={(e) => setForm((f) => ({ ...f, billingCycle: e.target.value }))}>
                {CYCLES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Next due date" type="date" InputLabelProps={{ shrink: true }} value={form.nextDueDate} onChange={(e) => setForm((f) => ({ ...f, nextDueDate: e.target.value }))} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="URL" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} /></Grid>
            <Grid item xs={12}><TextField fullWidth size="small" multiline rows={2} label="Notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={save}>{editId ? 'Save' : 'Add'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
