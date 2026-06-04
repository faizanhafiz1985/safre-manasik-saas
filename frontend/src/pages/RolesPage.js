import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Button, Card, CardContent, Grid, List, ListItemButton, ListItemText,
  Chip, Table, TableHead, TableRow, TableCell, TableBody, Checkbox, Tooltip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Select, FormControl,
  InputLabel, CircularProgress, Divider, Alert,
} from '@mui/material';
import { Add, Delete, Save, Lock, Security, AdminPanelSettings } from '@mui/icons-material';
import api from '../services/api';
import { toast } from 'react-toastify';

export default function RolesPage() {
  const [roles, setRoles] = useState([]);
  const [catalog, setCatalog] = useState({ features: [], actions: [] });
  const [users, setUsers] = useState([]);
  const [selId, setSelId] = useState(null);
  const [draft, setDraft] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newRole, setNewRole] = useState({ name: '', description: '' });

  const selected = roles.find((r) => r.id === selId);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cat, rs, us] = await Promise.all([
        api.get('/rbac/catalog'),
        api.get('/rbac/roles'),
        api.get('/users', { params: { limit: 100 } }).catch(() => ({ data: { data: [] } })),
      ]);
      setCatalog(cat.data);
      setRoles(rs.data);
      setUsers(us.data.data || []);
      if (!selId && rs.data.length) { setSelId(rs.data[0].id); setDraft(new Set(rs.data[0].permissions)); }
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to load roles');
    } finally { setLoading(false); }
  }, [selId]);
  useEffect(() => { load(); }, []);

  const selectRole = (r) => { setSelId(r.id); setDraft(new Set(r.permissions)); };

  const toggle = (feature, action) => {
    const key = `${feature}:${action}`;
    setDraft((d) => { const n = new Set(d); n.has(key) ? n.delete(key) : n.add(key); return n; });
  };

  const savePerms = async () => {
    setSaving(true);
    try {
      await api.put(`/rbac/roles/${selId}/permissions`, { permissions: [...draft] });
      toast.success('Permissions saved');
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const createRole = async () => {
    if (!newRole.name.trim()) return toast.error('Role name required');
    try {
      const r = await api.post('/rbac/roles', newRole);
      toast.success('Role created');
      setCreateOpen(false); setNewRole({ name: '', description: '' });
      await load(); setSelId(r.data.id); setDraft(new Set());
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to create'); }
  };

  const deleteRole = async (r) => {
    if (!window.confirm(`Delete role "${r.name}"? Users with it revert to their built-in role.`)) return;
    try { await api.delete(`/rbac/roles/${r.id}`); toast.success('Role deleted'); setSelId(null); load(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed to delete'); }
  };

  const assignUser = async (userId, customRoleId) => {
    try { await api.put(`/rbac/users/${userId}/role`, { customRoleId: customRoleId || null }); toast.success('Role assigned'); load(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed to assign'); }
  };

  if (loading) return <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress /></Box>;

  const canEditFeature = (f) => !(f.adminOnly && !selected?.isSystem); // custom roles can't get admin-only

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Box>
          <Typography variant="h5"><Security sx={{ verticalAlign: 'middle', mr: 1 }} />Roles & Permissions</Typography>
          <Typography variant="body2" color="text.secondary">Create custom roles and control which tabs each role can access.</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>New Role</Button>
      </Box>

      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        {/* Role list */}
        <Grid item xs={12} md={3}>
          <Card><List dense>
            {roles.map((r) => (
              <ListItemButton key={r.id} selected={r.id === selId} onClick={() => selectRole(r)}>
                <ListItemText
                  primary={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>{r.name}{r.isSystem && <Chip size="small" label="built-in" sx={{ height: 18, fontSize: 10 }} />}</Box>}
                  secondary={`${r.userCount} user(s) · ${r.permissions.length} perms`} />
                {!r.isSystem && <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); deleteRole(r); }}><Delete fontSize="small" /></IconButton>}
              </ListItemButton>
            ))}
          </List></Card>
        </Grid>

        {/* Permission matrix */}
        <Grid item xs={12} md={9}>
          <Card><CardContent>
            {!selected ? <Typography color="text.secondary">Select a role to edit its permissions.</Typography> : (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Box>
                    <Typography variant="h6">{selected.name} {selected.isSystem && <Chip size="small" label="built-in" />}</Typography>
                    <Typography variant="caption" color="text.secondary">{selected.description || 'Tick the actions this role may perform per module.'}</Typography>
                  </Box>
                  <Button variant="contained" startIcon={<Save />} onClick={savePerms} disabled={saving}>
                    {saving ? <CircularProgress size={18} color="inherit" /> : 'Save Permissions'}
                  </Button>
                </Box>
                <Alert severity="info" sx={{ mb: 1 }}>
                  “View” controls whether the tab appears. Greyed rows are locked by your plan or reserved for the built-in Admin role.
                </Alert>
                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead><TableRow>
                      <TableCell><strong>Module</strong></TableCell>
                      {catalog.actions.map((a) => <TableCell key={a} align="center"><strong>{a}</strong></TableCell>)}
                    </TableRow></TableHead>
                    <TableBody>
                      {catalog.features.map((f) => {
                        const editable = canEditFeature(f) && !f.planLocked;
                        return (
                          <TableRow key={f.key} sx={{ opacity: editable ? 1 : 0.5 }}>
                            <TableCell>
                              {f.label}
                              {f.adminOnly && <Tooltip title="Admin-only module"><AdminPanelSettings sx={{ fontSize: 14, ml: 0.5, verticalAlign: 'middle', color: '#C9A227' }} /></Tooltip>}
                              {f.planLocked && <Tooltip title={`Requires the ${f.plan} feature on your plan`}><Lock sx={{ fontSize: 14, ml: 0.5, verticalAlign: 'middle', color: '#999' }} /></Tooltip>}
                            </TableCell>
                            {catalog.actions.map((a) => (
                              <TableCell key={a} align="center">
                                <Checkbox size="small" disabled={!editable}
                                  checked={draft.has(`${f.key}:${a}`)}
                                  onChange={() => toggle(f.key, a)} />
                              </TableCell>
                            ))}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Box>
              </>
            )}
          </CardContent></Card>
        </Grid>
      </Grid>

      {/* User assignment */}
      <Card sx={{ mt: 2 }}><CardContent>
        <Typography variant="h6" gutterBottom>User Role Assignments</Typography>
        <Typography variant="caption" color="text.secondary">Assign a custom role to a user. “Default” keeps their built-in role ({'{'}Admin/Agent/Customer{'}'}).</Typography>
        <Box sx={{ overflowX: 'auto', mt: 1 }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>User</TableCell><TableCell>Email</TableCell><TableCell>Built-in Role</TableCell><TableCell>Assigned Role</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {users.filter((u) => u.role !== 'SUPER_ADMIN').map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell><Chip size="small" label={u.role} /></TableCell>
                  <TableCell>
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                      <Select value={u.customRoleId || ''} displayEmpty onChange={(e) => assignUser(u.id, e.target.value)}>
                        <MenuItem value=""><em>Default (built-in)</em></MenuItem>
                        {roles.map((r) => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && <TableRow><TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>No users</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Box>
      </CardContent></Card>

      {/* Create role dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New Custom Role</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth size="small" label="Role Name *" sx={{ mt: 1, mb: 2 }}
            value={newRole.name} onChange={(e) => setNewRole({ ...newRole, name: e.target.value })} />
          <TextField fullWidth size="small" label="Description" multiline rows={2}
            value={newRole.description} onChange={(e) => setNewRole({ ...newRole, description: e.target.value })} />
          <Divider sx={{ my: 2 }} />
          <Typography variant="caption" color="text.secondary">After creating, tick the modules/actions this role may access, then Save Permissions.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createRole}>Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
