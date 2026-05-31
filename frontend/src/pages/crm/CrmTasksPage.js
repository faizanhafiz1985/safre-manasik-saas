import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, Table, TableHead, TableRow, TableCell, TableBody, Typography,
  Button, TextField, Chip, Select, MenuItem, FormControl, InputLabel,
  TablePagination, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, CircularProgress, Snackbar, Alert, IconButton, Tooltip, Tabs, Tab,
} from '@mui/material';
import { Add, Check, Cancel, Refresh, Warning, Edit } from '@mui/icons-material';
import { crmTasks, crmLeads } from '../../services/crmApi';
import api from '../../services/api';

const STATUS_COLORS = {
  PENDING: 'default', IN_PROGRESS: 'info', COMPLETED: 'success',
  CANCELLED: 'error', OVERDUE: 'error',
};
const PRIORITY_COLORS = { LOW: '#9CA3AF', MEDIUM: '#F59E0B', HIGH: '#EF4444' };
const EMPTY_FORM = { title: '', description: '', dueAt: '', priority: 'MEDIUM', assignedToId: '', leadId: '', reminderAt: '' };

export default function CrmTasksPage() {
  const [tasks, setTasks] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0); // 0=All, 1=Today, 2=Overdue
  const [statusFilter, setStatusFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [users, setUsers] = useState([]);
  const [leadOptions, setLeadOptions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Active staff for "Assigned To" + leads for the "Lead" dropdown
  useEffect(() => {
    api.get('/users/agents')
      .then((r) => setUsers(Array.isArray(r.data) ? r.data : (r.data.data || [])))
      .catch(() => setUsers([]));
    crmLeads.getAll({ page: 1, limit: 200 })
      .then((r) => setLeadOptions(r.data.data || []))
      .catch(() => setLeadOptions([]));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const params = { page: page + 1, limit: rowsPerPage, ...(statusFilter && { status: statusFilter }) };
    if (tab === 2) params.overdue = 'true';
    crmTasks.getAll(params)
      .then((r) => { setTasks(r.data.data); setTotal(r.data.total); })
      .catch(() => setSnackbar({ open: true, message: 'Failed to load tasks', severity: 'error' }))
      .finally(() => setLoading(false));
  }, [page, rowsPerPage, statusFilter, tab]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditingTask(null); setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit = (t) => {
    setEditingTask(t);
    setForm({
      title: t.title || '',
      description: t.description || '',
      dueAt: t.dueAt ? t.dueAt.substring(0, 16) : '',
      reminderAt: t.reminderAt ? t.reminderAt.substring(0, 16) : '',
      priority: t.priority || 'MEDIUM',
      assignedToId: t.assignedToId || '',
      leadId: t.leadId || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return setSnackbar({ open: true, message: 'Title is required', severity: 'error' });
    setSaving(true);
    const payload = {
      ...form,
      dueAt: form.dueAt || null,
      reminderAt: form.reminderAt || null,
      leadId: form.leadId || null,
      assignedToId: form.assignedToId || null,
    };
    try {
      if (editingTask) {
        await crmTasks.update(editingTask.id, payload);
        setSnackbar({ open: true, message: 'Task updated', severity: 'success' });
      } else {
        await crmTasks.create(payload);
        setSnackbar({ open: true, message: 'Task created', severity: 'success' });
      }
      setDialogOpen(false);
      load();
    } catch (e) {
      setSnackbar({ open: true, message: e.response?.data?.error || 'Failed', severity: 'error' });
    } finally { setSaving(false); }
  };

  const handleComplete = async (id) => {
    try {
      await crmTasks.complete(id);
      setSnackbar({ open: true, message: 'Task completed ✓', severity: 'success' });
      load();
    } catch { setSnackbar({ open: true, message: 'Failed', severity: 'error' }); }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this task?')) return;
    try {
      await crmTasks.remove(id);
      setSnackbar({ open: true, message: 'Task cancelled', severity: 'info' });
      load();
    } catch { setSnackbar({ open: true, message: 'Failed', severity: 'error' }); }
  };

  const isOverdue = (t) => t.dueAt && new Date(t.dueAt) < new Date() && !['COMPLETED', 'CANCELLED'].includes(t.status);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="#1B4B35">Tasks & Follow-ups</Typography>
          <Typography variant="body2" color="text.secondary">{total} tasks</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh"><IconButton onClick={load}><Refresh /></IconButton></Tooltip>
          <Button variant="contained" startIcon={<Add />} onClick={openNew}
            sx={{ bgcolor: '#1B4B35', '&:hover': { bgcolor: '#2E6B4F' } }}>
            Add Task
          </Button>
        </Box>
      </Box>

      <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Tabs value={tab} onChange={(_, v) => { setTab(v); setPage(0); }} sx={{ '& .MuiTab-root': { fontSize: '0.82rem', fontWeight: 600 } }}>
          <Tab label="All Tasks" />
          <Tab label="Today" />
          <Tab label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><Warning fontSize="small" color="error" />Overdue</Box>} />
        </Tabs>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }} label="Status">
            <MenuItem value="">All</MenuItem>
            {['PENDING','IN_PROGRESS','COMPLETED','CANCELLED','OVERDUE'].map((s) => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Card sx={{ borderRadius: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : (
          <>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f8f9fa' }}>
                <TableRow>
                  {['Title', 'Priority', 'Status', 'Due Date', 'Assigned To', 'Lead', 'Actions'].map((h) => (
                    <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.78rem' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {tasks.map((t) => (
                  <TableRow key={t.id} hover sx={{ bgcolor: isOverdue(t) ? '#FEF2F2' : 'inherit' }}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{t.title}</Typography>
                      {t.description && <Typography variant="caption" color="text.secondary">{t.description.substring(0, 60)}</Typography>}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: PRIORITY_COLORS[t.priority] }} />
                        <Typography variant="caption">{t.priority}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={isOverdue(t) ? 'OVERDUE' : t.status}
                        size="small"
                        color={isOverdue(t) ? 'error' : STATUS_COLORS[t.status] || 'default'}
                        sx={{ fontSize: '0.7rem' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color={isOverdue(t) ? 'error' : 'text.primary'}>
                        {t.dueAt ? new Date(t.dueAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{t.assignedTo?.name || '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{t.lead?.fullName || '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => openEdit(t)}><Edit fontSize="small" /></IconButton>
                        </Tooltip>
                        {!['COMPLETED','CANCELLED'].includes(t.status) && (
                          <>
                            <Tooltip title="Complete">
                              <IconButton size="small" color="success" onClick={() => handleComplete(t.id)}><Check fontSize="small" /></IconButton>
                            </Tooltip>
                            <Tooltip title="Cancel">
                              <IconButton size="small" color="error" onClick={() => handleCancel(t.id)}><Cancel fontSize="small" /></IconButton>
                            </Tooltip>
                          </>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
                {tasks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                      {tab === 2 ? 'No overdue tasks 🎉' : 'No tasks found.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination component="div" count={total} page={page} rowsPerPage={rowsPerPage}
              onPageChange={(_, p) => setPage(p)}
              onRowsPerPageChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
              rowsPerPageOptions={[10, 20, 50]} />
          </>
        )}
      </Card>

      {/* Create Task Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#1B4B35' }}>{editingTask ? 'Edit Task' : 'Create Task'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Title *" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Description" multiline rows={2} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Lead</InputLabel>
                <Select value={form.leadId || ''} onChange={(e) => setForm({ ...form, leadId: e.target.value })} label="Lead">
                  <MenuItem value=""><em>No lead</em></MenuItem>
                  {leadOptions.map((l) => (
                    <MenuItem key={l.id} value={l.id}>{l.fullName}{l.phone ? ` — ${l.phone}` : ''}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
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
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Priority</InputLabel>
                <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} label="Priority">
                  {['LOW','MEDIUM','HIGH'].map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Due Date & Time" type="datetime-local"
                InputLabelProps={{ shrink: true }} value={form.dueAt}
                onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Reminder At" type="datetime-local"
                InputLabelProps={{ shrink: true }} value={form.reminderAt}
                onChange={(e) => setForm({ ...form, reminderAt: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}
            sx={{ bgcolor: '#1B4B35', '&:hover': { bgcolor: '#2E6B4F' } }}>
            {saving ? <CircularProgress size={18} color="inherit" /> : editingTask ? 'Update Task' : 'Create Task'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
