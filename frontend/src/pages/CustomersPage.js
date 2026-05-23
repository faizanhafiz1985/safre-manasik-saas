import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Button, Card, Table, TableBody, TableCell, TableHead, TableRow,
  CircularProgress, Chip, TextField, InputAdornment, MenuItem, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, TablePagination, Divider,
} from '@mui/material';
import { Add, Search, Edit, Business, Person } from '@mui/icons-material';
import api from '../services/api';
import { toast } from 'react-toastify';
import { useForm, useWatch } from 'react-hook-form';
import { fmtDate } from '../utils/helpers';
import { PATTERNS, MESSAGES, alphaOnly } from '../utils/validation';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(0);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [open, setOpen]           = useState(false);
  const [editing, setEditing]     = useState(null);

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm();
  const watchedType = useWatch({ control, name: 'customerType', defaultValue: 'B2C' });
  const isB2B = watchedType === 'B2B';

  const load = useCallback(() => {
    setLoading(true);
    const params = {
      page: page + 1, limit: 15, role: 'CUSTOMER',
      ...(search && { search }),
      ...(typeFilter && { customerType: typeFilter }),
    };
    api.get('/users', { params })
      .then((r) => { setCustomers(r.data.data || []); setTotal(r.data.total || 0); })
      .catch((err) => toast.error(err.response?.data?.error || 'Failed to load customers'))
      .finally(() => setLoading(false));
  }, [page, search, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    reset({ role: 'CUSTOMER', customerType: 'B2C' });
    setOpen(true);
  };
  const openEdit = (c) => {
    setEditing(c);
    reset({ ...c, customerType: c.customerType || 'B2C' });
    setOpen(true);
  };

  const onSubmit = async (data) => {
    try {
      const payload = { ...data, role: 'CUSTOMER' };
      if (editing) await api.put(`/users/${editing.id}`, payload);
      else         await api.post('/users', payload);
      toast.success(editing ? 'Customer updated' : 'Customer created');
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save customer');
    }
  };

  const toggleActive = async (c) => {
    try {
      await api.put(`/users/${c.id}`, { isActive: !c.isActive });
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update customer');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Customers</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Add Customer</Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          sx={{ flex: 1 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
        />
        <TextField
          select label="Type" value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }}
          sx={{ width: 160 }}
        >
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
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Company / CR#</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Joined</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{c.name}</TableCell>
                    <TableCell>{c.email}</TableCell>
                    <TableCell>
                      <Chip
                        icon={c.customerType === 'B2B' ? <Business fontSize="small" /> : <Person fontSize="small" />}
                        label={c.customerType || 'B2C'}
                        size="small"
                        color={c.customerType === 'B2B' ? 'warning' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      {c.companyName || '—'}
                      {c.crNumber && (
                        <Typography variant="caption" display="block" color="text.secondary">CR: {c.crNumber}</Typography>
                      )}
                    </TableCell>
                    <TableCell>{c.phone || '—'}</TableCell>
                    <TableCell>
                      <Chip label={c.isActive ? 'Active' : 'Inactive'} color={c.isActive ? 'success' : 'error'} size="small" />
                    </TableCell>
                    <TableCell><Typography variant="caption">{fmtDate(c.createdAt)}</Typography></TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Button size="small" startIcon={<Edit />} onClick={() => openEdit(c)}>Edit</Button>
                        <Button size="small" color={c.isActive ? 'error' : 'success'} onClick={() => toggleActive(c)}>
                          {c.isActive ? 'Disable' : 'Enable'}
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
                {customers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>No customers found</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination rowsPerPageOptions={[15]} component="div" count={total} rowsPerPage={15} page={page} onPageChange={(_, p) => setPage(p)} />
          </>
        )}
      </Card>

      {/* Create / Edit Customer Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent dividers>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth label="Full Name *"
                  error={!!errors.name} helperText={errors.name?.message}
                  inputProps={{ onKeyDown: alphaOnly }}
                  {...register('name', { required: 'Name required', pattern: { value: PATTERNS.ALPHA_ONLY, message: MESSAGES.ALPHA_ONLY } })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth label="Email *"
                  error={!!errors.email} helperText={errors.email?.message}
                  {...register('email', { required: 'Email required', pattern: { value: PATTERNS.EMAIL, message: MESSAGES.EMAIL } })}
                />
              </Grid>
              {!editing && (
                <Grid item xs={12}>
                  <TextField fullWidth label="Password" type="password" helperText="Default: Temp@1234" {...register('password')} />
                </Grid>
              )}
              <Grid item xs={12}>
                <TextField
                  fullWidth label="Phone"
                  error={!!errors.phone} helperText={errors.phone?.message}
                  {...register('phone', { pattern: { value: PATTERNS.PHONE, message: MESSAGES.PHONE } })}
                />
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">Customer Classification</Typography>
                </Divider>
                <TextField fullWidth select label="Customer Type" defaultValue="B2C" {...register('customerType')}>
                  <MenuItem value="B2C">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Person fontSize="small" /> B2C — Individual Customer</Box>
                  </MenuItem>
                  <MenuItem value="B2B">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Business fontSize="small" /> B2B — Corporate / Company</Box>
                  </MenuItem>
                </TextField>
              </Grid>

              {isB2B ? (
                <>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth label="Company Name *"
                      error={!!errors.companyName} helperText={errors.companyName?.message}
                      {...register('companyName', { required: 'Company name required for B2B' })}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField fullWidth label="CR Number" {...register('crNumber')} />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField fullWidth label="VAT Number" {...register('vatNumber')} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth label="Address" {...register('address')} />
                  </Grid>
                </>
              ) : (
                <Grid item xs={12}>
                  <TextField fullWidth label="Company Name (optional)" {...register('companyName')} />
                </Grid>
              )}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">{editing ? 'Update' : 'Create'}</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
