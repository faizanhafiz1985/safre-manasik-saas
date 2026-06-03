import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Button, Card, Table, TableBody, TableCell, TableHead, TableRow,
  CircularProgress, Chip, TextField, InputAdornment, MenuItem, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, TablePagination, Divider, IconButton,
  ToggleButton, ToggleButtonGroup, Accordion, AccordionSummary, AccordionDetails,
  Collapse, Tooltip,
} from '@mui/material';
import {
  Add, Search, Edit, Business, Person, Delete, Receipt, ExpandMore, PersonAdd,
} from '@mui/icons-material';
import api from '../services/api';
import { toast } from 'react-toastify';
import { useForm, useWatch, useFieldArray, Controller } from 'react-hook-form';
import { fmtDate } from '../utils/helpers';
import { PATTERNS, numericOnly, alphaOnly } from '../utils/validation';

const GENDERS = ['Male', 'Female'];
const D12 = /^\d{12}$/;
const D10 = /^\d{10}$/;

const EMPTY_PASSENGER = { firstName: '', lastName: '', mobile: '', whatsapp: '', passport: '', email: '', gender: '' };
const EMPTY_FORM = {
  type: 'B2C', firstName: '', lastName: '', mobile: '', whatsapp: '', passport: '', email: '', gender: '',
  companyName: '', crNumber: '', nationalAddress: '', passengers: [],
};

// Reusable validation rule sets
const nameRules = { required: 'Required', pattern: { value: PATTERNS.ALPHA_ONLY, message: 'Letters only' } };
const reqMobileRules = { required: 'Required', validate: (v) => D12.test((v || '').replace(/\s/g, '')) || 'Exactly 12 digits' };
const optMobileRules = { validate: (v) => !v || D12.test((v || '').replace(/\s/g, '')) || 'Exactly 12 digits' };
const emailRules = { validate: (v) => !v || PATTERNS.EMAIL.test(v) || 'Invalid email' };

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(0);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [open, setOpen]           = useState(false);
  const [editing, setEditing]     = useState(null);
  const [saving, setSaving]       = useState(false);

  const { register, handleSubmit, reset, control, setValue, formState: { errors } } =
    useForm({ defaultValues: EMPTY_FORM, shouldUnregister: true });
  const { fields, append, remove } = useFieldArray({ control, name: 'passengers' });

  const watchedType = useWatch({ control, name: 'type' }) || 'B2C';
  const isB2B = watchedType === 'B2B';
  const watchedAll = useWatch({ control }); // for the live summary

  const load = useCallback(() => {
    setLoading(true);
    const params = {
      page: page + 1, limit: 15,
      ...(search && { search }),
      ...(typeFilter && { type: typeFilter }),
    };
    api.get('/customers', { params })
      .then((r) => { setCustomers(r.data.data || []); setTotal(r.data.total || 0); })
      .catch((err) => toast.error(err.response?.data?.error || 'Failed to load customers'))
      .finally(() => setLoading(false));
  }, [page, search, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); reset(EMPTY_FORM); setOpen(true); };

  const openEdit = async (c) => {
    setEditing(c);
    // Fetch full record (with passengers) for editing
    try {
      const r = await api.get(`/customers/${c.id}`);
      const d = r.data;
      reset({
        type: d.type || 'B2C',
        firstName: d.firstName || '', lastName: d.lastName || '',
        mobile: d.mobile || '', whatsapp: d.whatsapp || '',
        passport: d.passport || '', email: d.email || '', gender: d.gender || '',
        companyName: d.companyName || '', crNumber: d.crNumber || '', nationalAddress: d.nationalAddress || '',
        passengers: (d.passengers || []).map((p) => ({
          firstName: p.firstName || '', lastName: p.lastName || '', mobile: p.mobile || '',
          whatsapp: p.whatsapp || '', passport: p.passport || '', email: p.email || '', gender: p.gender || '',
        })),
      });
      setOpen(true);
    } catch {
      toast.error('Failed to load customer');
    }
  };

  const onSubmit = async (data) => {
    setSaving(true);
    const payload = { ...data };
    if (data.type !== 'B2B') { payload.passengers = []; payload.companyName = ''; payload.crNumber = ''; payload.nationalAddress = ''; }
    try {
      if (editing) await api.put(`/customers/${editing.id}`, payload);
      else         await api.post('/customers', payload);
      toast.success(editing ? 'Customer updated' : 'Customer created');
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save customer');
    } finally { setSaving(false); }
  };

  const onInvalid = () => toast.error('Please fix the highlighted fields before submitting');

  const handleDelete = async (c) => {
    if (!window.confirm(`Delete customer "${c.firstName} ${c.lastName}"? This also removes its passengers.`)) return;
    try {
      await api.delete(`/customers/${c.id}`);
      toast.success('Customer deleted');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to delete'); }
  };

  const printVoucher = async (c) => {
    try {
      const r = await api.get(`/customers/${c.id}/voucher`, { responseType: 'text' });
      const w = window.open('', '_blank');
      if (!w) { toast.error('Pop-up blocked — allow pop-ups to print the voucher'); return; }
      w.document.write(r.data);
      w.document.close();
    } catch { toast.error('Failed to load voucher'); }
  };

  // ── Reusable person fields (main customer or a passenger) ──────────────────
  // NOTE: this is a plain function (called as {personFields(...)}), NOT a nested
  // <Component/>. Rendering it as a component would give it a new type on every
  // re-render (the live summary re-renders on each keystroke) and cause inputs to
  // lose focus. Calling it as a function inlines the elements with stable identity.
  const personFields = (prefix, errs, reqPhones) => (
    <>
      <Grid item xs={12} sm={6}>
        <TextField fullWidth size="small" label="First Name *"
          error={!!errs?.firstName} helperText={errs?.firstName?.message}
          inputProps={{ onKeyDown: alphaOnly }}
          {...register(`${prefix}firstName`, nameRules)} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField fullWidth size="small" label="Last Name *"
          error={!!errs?.lastName} helperText={errs?.lastName?.message}
          inputProps={{ onKeyDown: alphaOnly }}
          {...register(`${prefix}lastName`, nameRules)} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField fullWidth size="small" label={reqPhones ? 'Mobile # *' : 'Mobile #'}
          error={!!errs?.mobile} helperText={errs?.mobile?.message || 'e.g. 966501234567 (12 digits)'}
          inputProps={{ onKeyDown: numericOnly, maxLength: 12 }}
          {...register(`${prefix}mobile`, reqPhones ? reqMobileRules : optMobileRules)} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField fullWidth size="small" label={reqPhones ? 'WhatsApp # *' : 'WhatsApp #'}
          error={!!errs?.whatsapp} helperText={errs?.whatsapp?.message || 'e.g. 966501234567 (12 digits)'}
          inputProps={{ onKeyDown: numericOnly, maxLength: 12 }}
          {...register(`${prefix}whatsapp`, reqPhones ? reqMobileRules : optMobileRules)} />
      </Grid>
      <Grid item xs={12} sm={4}>
        <TextField fullWidth size="small" label="Passport # (optional)" {...register(`${prefix}passport`)} />
      </Grid>
      <Grid item xs={12} sm={4}>
        <TextField fullWidth size="small" label="Email (optional)"
          error={!!errs?.email} helperText={errs?.email?.message}
          {...register(`${prefix}email`, emailRules)} />
      </Grid>
      <Grid item xs={12} sm={4}>
        <Controller control={control} name={`${prefix}gender`} defaultValue=""
          render={({ field }) => (
            <TextField {...field} select fullWidth size="small" label="Gender (optional)">
              <MenuItem value="">—</MenuItem>
              {GENDERS.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
            </TextField>
          )} />
      </Grid>
    </>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Customers</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Add Customer</Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField placeholder="Search name, mobile, company, CR…" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }} sx={{ flex: 1, minWidth: 220 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} />
        <TextField select label="Type" value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }} sx={{ width: 180 }}>
          <MenuItem value="">All Types</MenuItem>
          <MenuItem value="B2C">B2C — Individual</MenuItem>
          <MenuItem value="B2B">B2B — Corporate</MenuItem>
        </TextField>
      </Box>

      <Card>
        {loading ? (
          <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box>
        ) : (
          <>
            <Box sx={{ overflowX: 'auto' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Company / CR#</TableCell>
                  <TableCell>Mobile</TableCell>
                  <TableCell align="center">Passengers</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{c.firstName} {c.lastName}</TableCell>
                    <TableCell>
                      <Chip icon={c.type === 'B2B' ? <Business fontSize="small" /> : <Person fontSize="small" />}
                        label={c.type || 'B2C'} size="small" color={c.type === 'B2B' ? 'warning' : 'default'} />
                    </TableCell>
                    <TableCell>
                      {c.companyName || '—'}
                      {c.crNumber && <Typography variant="caption" display="block" color="text.secondary">CR: {c.crNumber}</Typography>}
                    </TableCell>
                    <TableCell>{c.mobile || '—'}</TableCell>
                    <TableCell align="center">{c.type === 'B2B' ? (c._count?.passengers ?? 0) : '—'}</TableCell>
                    <TableCell><Typography variant="caption">{fmtDate(c.createdAt)}</Typography></TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                        <Tooltip title="Print Voucher"><IconButton size="small" color="primary" onClick={() => printVoucher(c)}><Receipt fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(c)}><Edit fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => handleDelete(c)}><Delete fontSize="small" /></IconButton></Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
                {customers.length === 0 && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>No customers found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            </Box>
            <TablePagination rowsPerPageOptions={[15]} component="div" count={total} rowsPerPage={15} page={page} onPageChange={(_, p) => setPage(p)} />
          </>
        )}
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={open} onClose={() => !saving && setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#1B4B35' }}>{editing ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit, onInvalid)}>
          <DialogContent dividers>
            {/* Customer type toggle */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Customer Type *</Typography>
              <Controller control={control} name="type" defaultValue="B2C"
                render={({ field }) => (
                  <ToggleButtonGroup exclusive value={field.value} onChange={(_, v) => v && field.onChange(v)} color="primary" size="small">
                    <ToggleButton value="B2C" sx={{ px: 3 }}><Person fontSize="small" sx={{ mr: 1 }} /> B2C — Individual</ToggleButton>
                    <ToggleButton value="B2B" sx={{ px: 3 }}><Business fontSize="small" sx={{ mr: 1 }} /> B2B — Business</ToggleButton>
                  </ToggleButtonGroup>
                )} />
            </Box>

            {/* B2B company section (smooth show/hide) */}
            <Collapse in={isB2B} unmountOnExit>
              <Card variant="outlined" sx={{ p: 2, mb: 2, bgcolor: '#FFF9F0', borderColor: '#F0D9A8' }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, color: '#8A6D1A' }}>
                  <Business fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} /> Company Details
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth size="small" label="Company Name *"
                      error={!!errors.companyName} helperText={errors.companyName?.message}
                      {...register('companyName', isB2B ? { required: 'Required', pattern: { value: PATTERNS.ALPHANUMERIC, message: 'Letters and numbers only' } } : {})} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth size="small" label="CR # *"
                      error={!!errors.crNumber} helperText={errors.crNumber?.message || 'Exactly 10 digits'}
                      inputProps={{ onKeyDown: numericOnly, maxLength: 10 }}
                      {...register('crNumber', isB2B ? { required: 'Required', validate: (v) => D10.test((v || '').replace(/\s/g, '')) || 'Exactly 10 digits' } : {})} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth size="small" label="National Address *"
                      error={!!errors.nationalAddress} helperText={errors.nationalAddress?.message}
                      {...register('nationalAddress', isB2B ? { required: 'Required' } : {})} />
                  </Grid>
                </Grid>
              </Card>
            </Collapse>

            {/* Main customer / B2B primary contact */}
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: '#1B4B35' }}>
              {isB2B ? 'Primary Contact' : 'Customer Details'}
            </Typography>
            <Grid container spacing={2}>
              {personFields('', errors, true)}
            </Grid>

            {/* B2B child passengers */}
            <Collapse in={isB2B} unmountOnExit>
              <Box sx={{ mt: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#1B4B35' }}>
                    Passengers ({fields.length})
                  </Typography>
                  <Button size="small" startIcon={<PersonAdd />} variant="outlined" onClick={() => append({ ...EMPTY_PASSENGER })}>
                    Add Passenger
                  </Button>
                </Box>
                {fields.length === 0 && (
                  <Typography variant="caption" color="text.secondary">No passengers added. Click “Add Passenger” to add child records.</Typography>
                )}
                {fields.map((f, i) => (
                  <Card key={f.id} variant="outlined" sx={{ p: 2, mb: 1.5, position: 'relative' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Chip label={`Passenger ${i + 1}`} size="small" />
                      <IconButton size="small" color="error" onClick={() => remove(i)}><Delete fontSize="small" /></IconButton>
                    </Box>
                    <Grid container spacing={2}>
                      {personFields(`passengers.${i}.`, errors.passengers?.[i], false)}
                    </Grid>
                  </Card>
                ))}
              </Box>
            </Collapse>

            {/* Summary before submit */}
            <Accordion sx={{ mt: 2, bgcolor: '#F7FAF8' }} disableGutters>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle2" fontWeight={700}>Review entered data</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2"><strong>Type:</strong> {watchedAll?.type || 'B2C'}</Typography>
                {isB2B && <Typography variant="body2"><strong>Company:</strong> {watchedAll?.companyName || '—'} (CR: {watchedAll?.crNumber || '—'})</Typography>}
                {isB2B && <Typography variant="body2"><strong>National Address:</strong> {watchedAll?.nationalAddress || '—'}</Typography>}
                <Typography variant="body2"><strong>{isB2B ? 'Primary Contact' : 'Name'}:</strong> {watchedAll?.firstName} {watchedAll?.lastName}</Typography>
                <Typography variant="body2"><strong>Mobile:</strong> {watchedAll?.mobile || '—'} · <strong>WhatsApp:</strong> {watchedAll?.whatsapp || '—'}</Typography>
                <Typography variant="body2"><strong>Passport:</strong> {watchedAll?.passport || '—'} · <strong>Email:</strong> {watchedAll?.email || '—'} · <strong>Gender:</strong> {watchedAll?.gender || '—'}</Typography>
                {isB2B && (
                  <>
                    <Typography variant="body2" sx={{ mt: 1 }}><strong>Passengers ({(watchedAll?.passengers || []).length}):</strong></Typography>
                    {(watchedAll?.passengers || []).map((p, i) => (
                      <Typography key={i} variant="caption" display="block" color="text.secondary">
                        {i + 1}. {p.firstName} {p.lastName} — {p.passport || 'no passport'} — {p.mobile || 'no mobile'}
                      </Typography>
                    ))}
                  </>
                )}
              </AccordionDetails>
            </Accordion>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? <CircularProgress size={18} color="inherit" /> : editing ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
