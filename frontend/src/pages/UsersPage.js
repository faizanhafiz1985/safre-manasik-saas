import React, { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, Card, Table, TableBody, TableCell, TableHead, TableRow, CircularProgress, Chip, TextField, InputAdornment, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Grid, TablePagination, Divider, FormControl, Select } from '@mui/material';
import { Add, Search, Edit, Business, Person, Security, Delete } from '@mui/icons-material';
import api from '../services/api';
import { toast } from 'react-toastify';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { fmtDate } from '../utils/helpers';
import { PATTERNS, MESSAGES, alphaOnly } from '../utils/validation';

const roleColor = { ADMIN: 'secondary', AGENT: 'primary', CUSTOMER: 'success' };

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [customRoles, setCustomRoles] = useState([]);

  // Custom roles (RBAC) for the assignment dropdowns. ADMIN-only page, so the
  // /rbac/roles call is permitted; fail silently for safety.
  useEffect(() => {
    api.get('/rbac/roles').then((r) => setCustomRoles(r.data || [])).catch(() => setCustomRoles([]));
  }, []);

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm();
  const watchedRole = useWatch({ control, name: 'role', defaultValue: 'CUSTOMER' });
  const watchedType = useWatch({ control, name: 'customerType', defaultValue: 'B2C' });
  const isB2B = watchedRole === 'CUSTOMER' && watchedType === 'B2B';

  const load = useCallback(() => {
    setLoading(true);
    api.get('/users', { params: { page: page + 1, limit: 15, ...(search && { search }), ...(roleFilter && { role: roleFilter }) } })
      .then((r) => { setUsers(r.data.data || []); setTotal(r.data.total || 0); })
      .catch((err) => toast.error(err.response?.data?.error || 'Failed to load users'))
      .finally(() => setLoading(false));
  }, [page, search, roleFilter]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); reset({ role: 'CUSTOMER', customerType: 'B2C' }); setOpen(true); };
  const openEdit   = (u) => { setEditing(u); reset({ ...u, customerType: u.customerType || 'B2C' }); setOpen(true); };

  const onSubmit = async (data) => {
    try {
      let userId;
      if (editing) { await api.put(`/users/${editing.id}`, data); userId = editing.id; }
      else { const r = await api.post('/users', data); userId = r.data.id; }
      // Assign / change the custom role if the selection differs.
      const desired = data.customRoleId || '';
      const current = editing?.customRoleId || '';
      if (userId && desired !== current) {
        await api.put(`/rbac/users/${userId}/role`, { customRoleId: desired || null });
      }
      toast.success(editing ? 'User updated' : 'User created');
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save user');
    }
  };

  // Inline (table) role assignment — assign directly from the Users list.
  const assignRole = async (userId, customRoleId) => {
    try {
      await api.put(`/rbac/users/${userId}/role`, { customRoleId: customRoleId || null });
      toast.success('Role assigned');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to assign role');
    }
  };

  const toggleActive = async (user) => {
    try {
      await api.put(`/users/${user.id}`, { isActive: !user.isActive });
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update user');
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Permanently delete "${user.name}"? This cannot be undone.\n\n(If the user has bookings, disable them instead.)`)) return;
    try {
      await api.delete(`/users/${user.id}`);
      toast.success('User deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete user');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">User Management</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Add User</Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField placeholder="Search users..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} sx={{ flex: 1 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} />
        <TextField select label="Role" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(0); }} sx={{ width: 160 }}>
          <MenuItem value="">All Roles</MenuItem>
          <MenuItem value="ADMIN">Admin</MenuItem>
          <MenuItem value="AGENT">Agent</MenuItem>
          <MenuItem value="CUSTOMER">Customer</MenuItem>
        </TextField>
      </Box>

      <Card>
        {loading ? <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box> : (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Assigned Role</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Joined</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell><Chip label={u.role} color={roleColor[u.role]} size="small" /></TableCell>
                    <TableCell>
                      {u.role === 'SUPER_ADMIN' ? '—' : (
                        <FormControl size="small" sx={{ minWidth: 150 }}>
                          <Select value={u.customRoleId || ''} displayEmpty onChange={(e) => assignRole(u.id, e.target.value)}>
                            <MenuItem value=""><em>Default (built-in)</em></MenuItem>
                            {customRoles.map((r) => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
                          </Select>
                        </FormControl>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.role === 'CUSTOMER'
                        ? <Chip icon={u.customerType === 'B2B' ? <Business fontSize="small" /> : <Person fontSize="small" />}
                            label={u.customerType || 'B2C'} size="small"
                            color={u.customerType === 'B2B' ? 'warning' : 'default'} />
                        : '-'}
                    </TableCell>
                    <TableCell>{u.phone || '-'}</TableCell>
                    <TableCell><Chip label={u.isActive ? 'Active' : 'Inactive'} color={u.isActive ? 'success' : 'error'} size="small" /></TableCell>
                    <TableCell><Typography variant="caption">{fmtDate(u.createdAt)}</Typography></TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                        <Button size="small" startIcon={<Edit />} onClick={() => openEdit(u)}>Edit</Button>
                        <Button size="small" color={u.isActive ? 'warning' : 'success'} onClick={() => toggleActive(u)}>{u.isActive ? 'Disable' : 'Enable'}</Button>
                        <Button size="small" color="error" startIcon={<Delete />} onClick={() => handleDelete(u)}>Delete</Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination rowsPerPageOptions={[15]} component="div" count={total} rowsPerPage={15} page={page} onPageChange={(e, p) => setPage(p)} />
          </>
        )}
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit User' : 'Create User'}</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent dividers>
            <Grid container spacing={2}>
              <Grid item xs={12}><TextField fullWidth label="Full Name *" error={!!errors.name} helperText={errors.name?.message} inputProps={{ onKeyDown: alphaOnly }} {...register('name', { required: 'Name required', pattern: { value: PATTERNS.ALPHA_ONLY, message: MESSAGES.ALPHA_ONLY } })} /></Grid>
              <Grid item xs={12}><TextField fullWidth label="Email *" error={!!errors.email} helperText={errors.email?.message} {...register('email', { required: 'Email required', pattern: { value: PATTERNS.EMAIL, message: MESSAGES.EMAIL } })} /></Grid>
              {!editing && <Grid item xs={12}><TextField fullWidth label="Password" type="password" helperText="Default: Temp@1234" {...register('password')} /></Grid>}

              <Grid item xs={6}>
                <Controller name="role" control={control} defaultValue="CUSTOMER" render={({ field }) => (
                  <TextField fullWidth select label="Role" {...field}>
                    <MenuItem value="ADMIN">Admin</MenuItem>
                    <MenuItem value="AGENT">Agent</MenuItem>
                    <MenuItem value="CUSTOMER">Customer</MenuItem>
                  </TextField>
                )} />
              </Grid>
              <Grid item xs={6}><TextField fullWidth label="Phone" error={!!errors.phone} helperText={errors.phone?.message} {...register('phone', { pattern: { value: PATTERNS.PHONE, message: MESSAGES.PHONE } })} /></Grid>

              {/* RBAC custom-role assignment */}
              <Grid item xs={12}>
                <Controller name="customRoleId" control={control} defaultValue="" render={({ field }) => (
                  <TextField fullWidth select label="Custom Role (optional)" {...field} value={field.value || ''}
                    helperText="Overrides the built-in role's tab access. “Default” keeps the built-in role."
                    InputProps={{ startAdornment: <InputAdornment position="start"><Security fontSize="small" sx={{ color: '#C9A227' }} /></InputAdornment> }}>
                    <MenuItem value=""><em>Default (built-in role)</em></MenuItem>
                    {customRoles.map((r) => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
                  </TextField>
                )} />
              </Grid>

              {/* Customer Type — only shown for CUSTOMER role */}
              {watchedRole === 'CUSTOMER' && (
                <>
                  <Grid item xs={12}>
                    <Divider sx={{ mb: 1 }}><Typography variant="caption" color="text.secondary">Customer Classification</Typography></Divider>
                    <Controller name="customerType" control={control} defaultValue="B2C" render={({ field }) => (
                      <TextField fullWidth select label="Customer Type" {...field}>
                        <MenuItem value="B2C"><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Person fontSize="small" /> B2C — Individual Customer</Box></MenuItem>
                        <MenuItem value="B2B"><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Business fontSize="small" /> B2B — Corporate / Company</Box></MenuItem>
                      </TextField>
                    )} />
                  </Grid>

                  {isB2B && (
                    <>
                      <Grid item xs={12}><TextField fullWidth label="Company Name *" error={!!errors.companyName} helperText={errors.companyName?.message} {...register('companyName', { required: isB2B ? 'Company name required for B2B' : false, pattern: { value: PATTERNS.ALPHANUMERIC, message: MESSAGES.ALPHANUMERIC } })} /></Grid>
                      <Grid item xs={6}><TextField fullWidth label="CR Number (Commercial Registration)" error={!!errors.crNumber} helperText={errors.crNumber?.message} {...register('crNumber', { required: isB2B ? 'CR# required for B2B' : false })} /></Grid>
                      <Grid item xs={6}><TextField fullWidth label="VAT Number" {...register('vatNumber')} /></Grid>
                      <Grid item xs={12}><TextField fullWidth label="Address" {...register('address')} /></Grid>
                    </>
                  )}

                  {!isB2B && (
                    <Grid item xs={12}><TextField fullWidth label="Company Name" error={!!errors.companyName} helperText={errors.companyName?.message} {...register('companyName', { pattern: { value: PATTERNS.ALPHANUMERIC, message: MESSAGES.ALPHANUMERIC } })} /></Grid>
                  )}
                </>
              )}

              {/* For AGENT/ADMIN roles */}
              {watchedRole !== 'CUSTOMER' && (
                <>
                  <Grid item xs={12}><TextField fullWidth label="Company Name" error={!!errors.companyName} helperText={errors.companyName?.message} {...register('companyName', { pattern: { value: PATTERNS.ALPHANUMERIC, message: MESSAGES.ALPHANUMERIC } })} /></Grid>
                  <Grid item xs={12}><TextField fullWidth label="Address" {...register('address')} /></Grid>
                </>
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
