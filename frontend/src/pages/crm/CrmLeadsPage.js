import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, Table, TableHead, TableRow, TableCell, TableBody, Typography,
  Button, TextField, InputAdornment, IconButton, Chip, Select, MenuItem,
  FormControl, InputLabel, TablePagination, Dialog, DialogTitle, DialogContent,
  DialogActions, Grid, Alert, CircularProgress, Tooltip, Snackbar, Autocomplete,
} from '@mui/material';
import {
  Search, Add, Edit, Delete, Phone, WhatsApp, Refresh,
  FilterList, Download, Upload,
} from '@mui/icons-material';
import { crmLeads } from '../../services/crmApi';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { COUNTRIES, CITIES_BY_COUNTRY } from '../../constants/locations';

const STATUS_COLORS = {
  NEW: 'default', CONTACTED: 'warning', QUALIFIED: 'info',
  PROPOSAL_SENT: 'secondary', NEGOTIATION: 'secondary',
  CONFIRMED: 'success', CONVERTED: 'success',
  LOST: 'error', SPAM: 'default', FOLLOW_UP_PENDING: 'warning',
};

const PRIORITY_COLORS = { LOW: '#9CA3AF', MEDIUM: '#F59E0B', HIGH: '#EF4444', URGENT: '#7C3AED' };

const SOURCE_LABELS = {
  MANUAL: 'Manual', WHATSAPP: 'WhatsApp', FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram', WEBSITE: 'Website', REFERRAL: 'Referral',
  WALK_IN: 'Walk-in', PHONE: 'Phone', EMAIL: 'Email', OTHER: 'Other',
};

const EMPTY_FORM = {
  fullName: '', phone: '', whatsappNumber: '', email: '', country: '', city: '',
  packageInterest: '', budget: '', numberOfTravelers: '',
  source: 'MANUAL', status: 'NEW', priority: 'MEDIUM', notes: '',
  preferredDateFrom: '', preferredDateTo: '', assignedToId: '',
};

// Validate the lead form. Returns an object of field -> error message.
const validateLead = (form) => {
  const errs = {};
  const name = (form.fullName || '').trim();
  if (!name) errs.fullName = 'Full name is required';
  else if (!/^[A-Za-z؀-ۿ\s.'-]+$/.test(name)) errs.fullName = 'Name may contain letters only (no numbers)';

  const phoneDigits = (form.phone || '').replace(/\D/g, '');
  const waDigits = (form.whatsappNumber || '').replace(/\D/g, '');

  if (form.phone && !/^\d{12,15}$/.test(phoneDigits)) errs.phone = 'Enter 12–15 digits incl. country code, e.g. 966501234567';
  if (form.whatsappNumber && !/^\d{12,15}$/.test(waDigits)) errs.whatsappNumber = 'Enter 12–15 digits incl. country code, e.g. 966501234567';

  // Either phone OR WhatsApp number is mandatory
  if (!form.phone && !form.whatsappNumber) {
    errs.phone = 'Provide a phone or WhatsApp number';
    errs.whatsappNumber = 'Provide a phone or WhatsApp number';
  }

  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Enter a valid email address';

  // Budget mandatory and numeric
  if (form.budget === '' || form.budget === null || form.budget === undefined) errs.budget = 'Budget is required';
  else if (!/^\d+(\.\d+)?$/.test(String(form.budget))) errs.budget = 'Budget must be a number';

  return errs;
};

export default function CrmLeadsPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Active staff (ADMIN + AGENT) for the "Assigned To" dropdown
  useEffect(() => {
    api.get('/users/agents')
      .then((r) => setUsers(Array.isArray(r.data) ? r.data : (r.data.data || [])))
      .catch(() => setUsers([]));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    crmLeads.getAll({
      page: page + 1, limit: rowsPerPage,
      ...(search && { search }),
      ...(statusFilter && { status: statusFilter }),
      ...(sourceFilter && { source: sourceFilter }),
    })
      .then((r) => { setLeads(r.data.data); setTotal(r.data.total); })
      .catch(() => setSnackbar({ open: true, message: 'Failed to load leads', severity: 'error' }))
      .finally(() => setLoading(false));
  }, [page, rowsPerPage, search, statusFilter, sourceFilter]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    const errs = validateLead(form);
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) {
      return setSnackbar({ open: true, message: 'Please fix the highlighted fields', severity: 'error' });
    }
    setSaving(true);
    try {
      if (editingLead) {
        await crmLeads.update(editingLead.id, form);
        setSnackbar({ open: true, message: 'Lead updated', severity: 'success' });
      } else {
        await crmLeads.create(form);
        setSnackbar({ open: true, message: 'Lead created', severity: 'success' });
      }
      setDialogOpen(false);
      load();
    } catch (e) {
      setSnackbar({ open: true, message: e.response?.data?.error || 'Failed to save', severity: 'error' });
    } finally { setSaving(false); }
  };

  const openNew = () => { setEditingLead(null); setForm(EMPTY_FORM); setFormErrors({}); setDialogOpen(true); };
  const openEdit = (l) => { setEditingLead(l); setFormErrors({}); setForm({ ...EMPTY_FORM, ...l, budget: l.budget || '', numberOfTravelers: l.numberOfTravelers || '', assignedToId: l.assignedToId || '', preferredDateFrom: l.preferredDateFrom ? l.preferredDateFrom.split('T')[0] : '', preferredDateTo: l.preferredDateTo ? l.preferredDateTo.split('T')[0] : '' }); setDialogOpen(true); };

  const handleArchive = async (id) => {
    if (!window.confirm('Archive this lead?')) return;
    try {
      await crmLeads.remove(id);
      setSnackbar({ open: true, message: 'Lead archived', severity: 'success' });
      load();
    } catch { setSnackbar({ open: true, message: 'Failed to archive', severity: 'error' }); }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="#1B4B35">Leads</Typography>
          <Typography variant="body2" color="text.secondary">{total} total leads</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh"><IconButton onClick={load}><Refresh /></IconButton></Tooltip>
          <Button variant="contained" startIcon={<Add />} onClick={openNew}
            sx={{ bgcolor: '#1B4B35', '&:hover': { bgcolor: '#2E6B4F' } }}>
            Add Lead
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Card sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField size="small" placeholder="Search name, phone, email..."
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
            sx={{ flex: 1, minWidth: 220 }} />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }} label="Status">
              <MenuItem value="">All</MenuItem>
              {['NEW','CONTACTED','QUALIFIED','PROPOSAL_SENT','NEGOTIATION','CONFIRMED','CONVERTED','LOST','FOLLOW_UP_PENDING'].map((s) => (
                <MenuItem key={s} value={s}>{s.replace(/_/g, ' ')}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Source</InputLabel>
            <Select value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setPage(0); }} label="Source">
              <MenuItem value="">All</MenuItem>
              {Object.entries(SOURCE_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
      </Card>

      {/* Table */}
      <Card sx={{ borderRadius: 2, overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : (
          <>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f8f9fa' }}>
                <TableRow>
                  {['Name', 'Phone', 'Source', 'Status', 'Priority', 'Assigned To', 'Created', 'Actions'].map((h) => (
                    <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.78rem', color: '#374151' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {leads.map((l) => (
                  <TableRow key={l.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{l.fullName}</Typography>
                      {l.email && <Typography variant="caption" color="text.secondary">{l.email}</Typography>}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                        {l.phone && <Typography variant="caption">{l.phone}</Typography>}
                        {l.whatsappNumber && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <WhatsApp sx={{ fontSize: 12, color: '#25D366' }} />
                            <Typography variant="caption" color="text.secondary">{l.whatsappNumber}</Typography>
                          </Box>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip label={SOURCE_LABELS[l.source] || l.source} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                    </TableCell>
                    <TableCell>
                      <Chip label={l.status.replace(/_/g, ' ')} size="small" color={STATUS_COLORS[l.status] || 'default'} sx={{ fontSize: '0.7rem' }} />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: PRIORITY_COLORS[l.priority] }} />
                        <Typography variant="caption">{l.priority}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{l.assignedTo?.name || '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{new Date(l.createdAt).toLocaleDateString()}</Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(l)}><Edit fontSize="small" /></IconButton></Tooltip>
                        {(user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && (
                          <Tooltip title="Archive"><IconButton size="small" color="error" onClick={() => handleArchive(l.id)}><Delete fontSize="small" /></IconButton></Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
                {leads.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                      No leads found. Add your first lead!
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination
              component="div" count={total} page={page} rowsPerPage={rowsPerPage}
              onPageChange={(_, p) => setPage(p)}
              onRowsPerPageChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
              rowsPerPageOptions={[10, 20, 50]}
            />
          </>
        )}
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#1B4B35' }}>
          {editingLead ? 'Edit Lead' : 'Add New Lead'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Full Name *" value={form.fullName}
                error={!!formErrors.fullName} helperText={formErrors.fullName || 'Letters only'}
                onChange={(e) => setForm({ ...form, fullName: e.target.value.replace(/[0-9]/g, '') })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Phone *" value={form.phone}
                error={!!formErrors.phone} helperText={formErrors.phone || 'e.g. 966501234567 (12 digits, country code first)'}
                onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/[^\d+\s]/g, '') })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="WhatsApp Number *" value={form.whatsappNumber}
                error={!!formErrors.whatsappNumber} helperText={formErrors.whatsappNumber || 'e.g. 966501234567 — phone or WhatsApp required'}
                onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value.replace(/[^\d+\s]/g, '') })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Email" value={form.email}
                error={!!formErrors.email} helperText={formErrors.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Autocomplete
                size="small" options={COUNTRIES} value={form.country || null}
                onChange={(_, v) => setForm({ ...form, country: v || '', city: '' })}
                renderInput={(params) => <TextField {...params} label="Country" />}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Autocomplete
                freeSolo size="small"
                options={CITIES_BY_COUNTRY[form.country] || []}
                value={form.city || ''}
                onChange={(_, v) => setForm({ ...form, city: v || '' })}
                onInputChange={(_, v) => setForm((f) => ({ ...f, city: v }))}
                renderInput={(params) => <TextField {...params} label="City" />}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Budget (SAR) *" type="number" value={form.budget}
                error={!!formErrors.budget} helperText={formErrors.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Package Interest" value={form.packageInterest}
                onChange={(e) => setForm({ ...form, packageInterest: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="No. of Travelers" type="number" value={form.numberOfTravelers}
                onChange={(e) => setForm({ ...form, numberOfTravelers: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Priority</InputLabel>
                <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} label="Priority">
                  {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Source</InputLabel>
                <Select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} label="Source">
                  {Object.entries(SOURCE_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} label="Status">
                  {['NEW','CONTACTED','QUALIFIED','PROPOSAL_SENT','NEGOTIATION','CONFIRMED','CONVERTED','LOST','FOLLOW_UP_PENDING'].map((s) => (
                    <MenuItem key={s} value={s}>{s.replace(/_/g, ' ')}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Assigned To</InputLabel>
                <Select value={form.assignedToId || ''} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })} label="Assigned To">
                  <MenuItem value=""><em>Unassigned</em></MenuItem>
                  {users.map((u) => (
                    <MenuItem key={u.id} value={u.id}>{u.name}{u.email ? ` (${u.email})` : ''}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Follow-up Date" type="date"
                InputLabelProps={{ shrink: true }} value={form.followUpAt ? form.followUpAt.split('T')[0] : ''}
                onChange={(e) => setForm({ ...form, followUpAt: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Preferred From" type="date"
                InputLabelProps={{ shrink: true }} value={form.preferredDateFrom}
                onChange={(e) => setForm({ ...form, preferredDateFrom: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Preferred To" type="date"
                InputLabelProps={{ shrink: true }} value={form.preferredDateTo}
                onChange={(e) => setForm({ ...form, preferredDateTo: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Notes" multiline rows={3} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}
            sx={{ bgcolor: '#1B4B35', '&:hover': { bgcolor: '#2E6B4F' } }}>
            {saving ? <CircularProgress size={18} color="inherit" /> : editingLead ? 'Update' : 'Create Lead'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
