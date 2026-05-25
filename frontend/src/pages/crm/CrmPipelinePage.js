import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, CircularProgress, Alert,
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel, Grid,
  IconButton, Avatar, Tooltip, Snackbar,
} from '@mui/material';
import { Add, TrendingUp, EmojiEvents, Close, Refresh } from '@mui/icons-material';
import { crmPipelines, crmOpportunities } from '../../services/crmApi';

const OppCard = ({ opp, onMove }) => (
  <Card sx={{
    mb: 1.5, borderRadius: 2, cursor: 'grab', boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
    border: '1px solid #f0f0f0', transition: 'box-shadow 0.2s',
    '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.15)' },
  }}>
    <CardContent sx={{ pb: '12px !important', pt: 1.5, px: 2 }}>
      <Typography variant="body2" fontWeight={700} gutterBottom>{opp.title}</Typography>
      {opp.lead && (
        <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
          {opp.lead.fullName}
        </Typography>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
        <Typography variant="caption" color="#C9A227" fontWeight={700}>
          {opp.value ? `SAR ${Number(opp.value).toLocaleString()}` : 'No value'}
        </Typography>
        {opp.assignedTo && (
          <Avatar sx={{ width: 22, height: 22, fontSize: '0.65rem', bgcolor: '#1B4B35' }}>
            {opp.assignedTo.name.charAt(0)}
          </Avatar>
        )}
      </Box>
      <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
        <Chip label={`${opp.probability}%`} size="small" sx={{ fontSize: '0.65rem', height: 18, bgcolor: '#1B4B3510', color: '#1B4B35' }} />
        {opp.expectedCloseAt && (
          <Chip label={new Date(opp.expectedCloseAt).toLocaleDateString()} size="small" sx={{ fontSize: '0.65rem', height: 18 }} />
        )}
      </Box>
    </CardContent>
  </Card>
);

const EMPTY_OPP_FORM = { leadId: '', title: '', value: '', currency: 'SAR', expectedCloseAt: '', probability: 50, notes: '' };

export default function CrmPipelinePage() {
  const [pipelines, setPipelines] = useState([]);
  const [selectedPipeline, setSelectedPipeline] = useState(null);
  const [kanban, setKanban] = useState(null);
  const [loading, setLoading] = useState(true);
  const [kanbanLoading, setKanbanLoading] = useState(false);
  const [addOppOpen, setAddOppOpen] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState('');
  const [oppForm, setOppForm] = useState(EMPTY_OPP_FORM);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const loadPipelines = useCallback(() => {
    setLoading(true);
    crmPipelines.getAll()
      .then((r) => {
        setPipelines(r.data);
        if (r.data.length > 0 && !selectedPipeline) setSelectedPipeline(r.data[0]);
      })
      .catch(() => setSnackbar({ open: true, message: 'Failed to load pipelines', severity: 'error' }))
      .finally(() => setLoading(false));
  }, [selectedPipeline]);

  const loadKanban = useCallback(() => {
    if (!selectedPipeline) return;
    setKanbanLoading(true);
    crmPipelines.getKanban(selectedPipeline.id)
      .then((r) => setKanban(r.data))
      .catch(() => setSnackbar({ open: true, message: 'Failed to load pipeline board', severity: 'error' }))
      .finally(() => setKanbanLoading(false));
  }, [selectedPipeline]);

  useEffect(() => { loadPipelines(); }, []);
  useEffect(() => { if (selectedPipeline) loadKanban(); }, [selectedPipeline]);

  const handleCreatePipeline = async () => {
    try {
      const r = await crmPipelines.create({ name: 'New Pipeline' });
      setPipelines((prev) => [...prev, r.data]);
      setSelectedPipeline(r.data);
      setSnackbar({ open: true, message: 'Pipeline created', severity: 'success' });
    } catch (e) {
      setSnackbar({ open: true, message: e.response?.data?.error || 'Failed', severity: 'error' });
    }
  };

  const handleAddOpp = (stageId) => {
    setSelectedStageId(stageId);
    setOppForm(EMPTY_OPP_FORM);
    setAddOppOpen(true);
  };

  const handleSaveOpp = async () => {
    if (!oppForm.title.trim()) return setSnackbar({ open: true, message: 'Title is required', severity: 'error' });
    setSaving(true);
    try {
      await crmOpportunities.create({
        ...oppForm,
        pipelineId: selectedPipeline.id,
        stageId: selectedStageId,
        value: oppForm.value ? Number(oppForm.value) : null,
        probability: Number(oppForm.probability),
        expectedCloseAt: oppForm.expectedCloseAt || null,
      });
      setAddOppOpen(false);
      setSnackbar({ open: true, message: 'Opportunity added', severity: 'success' });
      loadKanban();
    } catch (e) {
      setSnackbar({ open: true, message: e.response?.data?.error || 'Failed', severity: 'error' });
    } finally { setSaving(false); }
  };

  const handleMarkWon = async (opp) => {
    if (!window.confirm(`Mark "${opp.title}" as WON?`)) return;
    try {
      await crmOpportunities.move(opp.id, { isWon: true });
      setSnackbar({ open: true, message: '🏆 Opportunity Won!', severity: 'success' });
      loadKanban();
    } catch { setSnackbar({ open: true, message: 'Failed', severity: 'error' }); }
  };

  const handleMarkLost = async (opp) => {
    const reason = window.prompt('Reason for loss (optional):');
    if (reason === null) return;
    try {
      await crmOpportunities.move(opp.id, { isLost: true, lostReason: reason });
      setSnackbar({ open: true, message: 'Opportunity marked as lost', severity: 'info' });
      loadKanban();
    } catch { setSnackbar({ open: true, message: 'Failed', severity: 'error' }); }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: 3, height: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="#1B4B35">Pipeline</Typography>
          <Typography variant="body2" color="text.secondary">Drag opportunities through your sales stages</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh"><IconButton onClick={loadKanban}><Refresh /></IconButton></Tooltip>
          <Button variant="outlined" onClick={handleCreatePipeline} size="small"
            sx={{ borderColor: '#1B4B35', color: '#1B4B35' }}>
            + New Pipeline
          </Button>
        </Box>
      </Box>

      {/* Pipeline selector */}
      {pipelines.length > 1 && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          {pipelines.map((p) => (
            <Chip
              key={p.id}
              label={p.name}
              onClick={() => setSelectedPipeline(p)}
              color={selectedPipeline?.id === p.id ? 'primary' : 'default'}
              sx={{
                bgcolor: selectedPipeline?.id === p.id ? '#1B4B35' : 'transparent',
                color: selectedPipeline?.id === p.id ? '#fff' : 'text.primary',
                fontWeight: 600,
              }}
            />
          ))}
        </Box>
      )}

      {/* Kanban board */}
      {kanbanLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>
      ) : kanban ? (
        <Box sx={{
          display: 'flex', gap: 2, overflowX: 'auto', pb: 2,
          '&::-webkit-scrollbar': { height: 6 },
          '&::-webkit-scrollbar-thumb': { bgcolor: '#ccc', borderRadius: 3 },
        }}>
          {(kanban.stages || []).filter((s) => !s.isWon && !s.isLost).map((stage) => (
            <Box key={stage.id} sx={{ minWidth: 280, maxWidth: 280, flexShrink: 0 }}>
              {/* Stage header */}
              <Box sx={{
                bgcolor: `${stage.color}15`, border: `2px solid ${stage.color}40`,
                borderRadius: '8px 8px 0 0', px: 2, py: 1.5,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <Box>
                  <Typography variant="body2" fontWeight={700} color={stage.color}>{stage.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {stage.opportunities.length} deal{stage.opportunities.length !== 1 ? 's' : ''} · {stage.probability}%
                  </Typography>
                </Box>
                <Chip
                  label={`SAR ${stage.opportunities.reduce((s, o) => s + Number(o.value || 0), 0).toLocaleString()}`}
                  size="small"
                  sx={{ bgcolor: `${stage.color}20`, color: stage.color, fontWeight: 700, fontSize: '0.65rem' }}
                />
              </Box>

              {/* Opportunities */}
              <Box sx={{
                bgcolor: '#fafafa', border: `1px solid ${stage.color}20`, borderTop: 'none',
                borderRadius: '0 0 8px 8px', p: 1.5, minHeight: 200,
              }}>
                {stage.opportunities.map((opp) => (
                  <Box key={opp.id} sx={{ position: 'relative' }}>
                    <OppCard opp={opp} />
                    <Box sx={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 0.3 }}>
                      <Tooltip title="Mark Won">
                        <IconButton size="small" onClick={() => handleMarkWon(opp)} sx={{ bgcolor: '#10B98115', p: 0.3 }}>
                          <EmojiEvents sx={{ fontSize: 14, color: '#10B981' }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Mark Lost">
                        <IconButton size="small" onClick={() => handleMarkLost(opp)} sx={{ bgcolor: '#EF444415', p: 0.3 }}>
                          <Close sx={{ fontSize: 14, color: '#EF4444' }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                ))}
                <Button size="small" startIcon={<Add />} onClick={() => handleAddOpp(stage.id)}
                  sx={{ width: '100%', color: stage.color, mt: 1, fontSize: '0.75rem',
                    border: `1px dashed ${stage.color}40`, borderRadius: 2, py: 0.8 }}>
                  Add Deal
                </Button>
              </Box>
            </Box>
          ))}
        </Box>
      ) : (
        <Alert severity="info">Select or create a pipeline to view the Kanban board.</Alert>
      )}

      {/* Add Opportunity Dialog */}
      <Dialog open={addOppOpen} onClose={() => setAddOppOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#1B4B35' }}>Add Opportunity</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Title *" value={oppForm.title}
                onChange={(e) => setOppForm({ ...oppForm, title: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Value (SAR)" type="number" value={oppForm.value}
                onChange={(e) => setOppForm({ ...oppForm, value: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Win Probability (%)" type="number"
                inputProps={{ min: 0, max: 100 }} value={oppForm.probability}
                onChange={(e) => setOppForm({ ...oppForm, probability: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Expected Close Date" type="date"
                InputLabelProps={{ shrink: true }} value={oppForm.expectedCloseAt}
                onChange={(e) => setOppForm({ ...oppForm, expectedCloseAt: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Notes" multiline rows={2} value={oppForm.notes}
                onChange={(e) => setOppForm({ ...oppForm, notes: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddOppOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveOpp} disabled={saving}
            sx={{ bgcolor: '#1B4B35', '&:hover': { bgcolor: '#2E6B4F' } }}>
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Add Opportunity'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
