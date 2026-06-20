import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Button, Card, Table, TableBody, TableCell, TableHead, TableRow,
  CircularProgress, Chip, TextField, InputAdornment, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, TablePagination, IconButton, Tooltip, Alert,
} from '@mui/material';
import { Add, Search, Edit, Delete } from '@mui/icons-material';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { useForm } from 'react-hook-form';
import { fmtDate } from '../utils/helpers';
import { PATTERNS, MESSAGES, alphaOnly } from '../utils/validation';

const PAGE_SIZE = 15;

// Customers are CUSTOMER-role User accounts — the SAME records used when creating
// a booking. A customer added during booking creation therefore shows up here too.
export default function CustomersPage() {
  const { isAdmin } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const load = useCallback(() => {
    setLoading(true);
    api.get('/users/customers', { params: { includeInactive: 1, ...(search && { search }) } })
      .then((r) => { setCustomers(r.data.data || []); setPage(0); })
      .catch((err) => toast.error(err.response?.data?.error || 'Failed to load customers'))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); reset({ name: '', email: '', phone: '', companyName: '' }); setOpen(true); };
  const openEdit = (c) => {
    setEditing(c);
    reset({ name: c.name || '', email: c.email || '', phone: c.phone || '', companyName: c.companyName || '' });
    setOpen(true);
  };

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      if (editing) {
        // Email is the login identity and isn't editable here.
        await api.put(`/users/${editing.id}`, { name: data.name, phone: data.phone, companyName: data.companyName });
        toast.success('Customer updated');
      } else {
        await api.post('/users', { ...data, role: 'CUSTOMER' });
        toast.success('Customer created');
      }
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save customer');
    } finally { setSaving(false); }
  };

  const handleDelete = async (c) => {
    if (!window.confirm(`Delete customer "${c.name}"? This removes their account.`)) return;
    try {
      await api.delete(`/users/${c.id}`);
      toast.success('Customer deleted');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to delete'); }
  };

  const paged = customers.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Customers</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Add Customer</Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField placeholder="Search name, email, phone, company…" value={search}
          onChange={(e) => setSearch(e.target.value)} sx={{ flex: 1, minWidth: 220 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} />
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
                  <TableCell>Email</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Joined</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paged.map((c) => (
                  <TableRow key={c.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{c.name}</TableCell>
                    <TableCell>{c.email}</TableCell>
                    <TableCell>{c.phone || '—'}</TableCell>
                    <TableCell>{c.companyName || '—'}</TableCell>
                    <TableCell>
                      <Chip label={c.isActive === false ? 'Disabled' : 'Active'} size="small"
                        color={c.isActive === false ? 'default' : 'success'} />
                    </TableCell>
                    <TableCell><Typography variant="caption">{fmtDate(c.createdAt)}</Typography></TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                        <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(c)}><Edit fontSize="small" /></IconButton></Tooltip>
                        {isAdmin && <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => handleDelete(c)}><Delete fontSize="small" /></IconButton></Tooltip>}
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
            <TablePagination rowsPerPageOptions={[PAGE_SIZE]} component="div" count={customers.length}
              rowsPerPage={PAGE_SIZE} page={page} onPageChange={(_, p) => setPage(p)} />
          </>
        )}
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={open} onClose={() => !saving && setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#1B4B35' }}>{editing ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent dividers>
            {!editing && (
              <Alert severity="info" sx={{ mb: 2 }}>
                A customer is a login-capable account — the same record used when creating bookings.
                They&apos;ll receive a welcome email with sign-in details.
              </Alert>
            )}
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField fullWidth label="Full Name *"
                  error={!!errors.name} helperText={errors.name?.message}
                  inputProps={{ onKeyDown: alphaOnly }}
                  {...register('name', { required: 'Name is required', pattern: { value: PATTERNS.ALPHA_ONLY, message: MESSAGES.ALPHA_ONLY } })} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Email *" disabled={!!editing}
                  error={!!errors.email} helperText={errors.email?.message || (editing ? 'Email is the login ID and cannot be changed here' : '')}
                  {...register('email', { required: 'Email is required', pattern: { value: PATTERNS.EMAIL, message: MESSAGES.EMAIL } })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Phone" {...register('phone')} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Company (optional)" {...register('companyName')} />
              </Grid>
            </Grid>
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
