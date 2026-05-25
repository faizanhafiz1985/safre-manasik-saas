import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, CircularProgress,
  Select, MenuItem, FormControl, InputLabel, Chip, Divider,
  LinearProgress, Table, TableHead, TableRow, TableCell, TableBody,
  Avatar, Tooltip, IconButton,
} from '@mui/material';
import { Refresh, TrendingUp, TrendingDown, Remove } from '@mui/icons-material';
import { crmReports } from '../../services/crmApi';

const METRIC_COLORS = {
  WHATSAPP: '#25D366', FACEBOOK: '#1877F2', INSTAGRAM: '#E4405F',
  WEBSITE: '#6366F1', REFERRAL: '#F59E0B', EMAIL: '#10B981',
  WALK_IN: '#8B5CF6', COLD_CALL: '#EF4444', PARTNER: '#EC4899', OTHER: '#9CA3AF',
};

const STATUS_COLORS = {
  NEW: '#6366F1', CONTACTED: '#F59E0B', QUALIFIED: '#10B981',
  PROPOSAL_SENT: '#3B82F6', NEGOTIATION: '#8B5CF6', WON: '#10B981',
  LOST: '#EF4444', SPAM: '#9CA3AF', UNQUALIFIED: '#F59E0B', DEFERRED: '#6B7280',
};

function MetricCard({ title, value, sub, color, trend, loading }) {
  return (
    <Card sx={{ borderRadius: 2, height: '100%' }}>
      <CardContent sx={{ pb: '16px !important' }}>
        {loading ? (
          <CircularProgress size={24} />
        ) : (
          <>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>{title}</Typography>
            <Typography variant="h4" fontWeight={800} color={color || '#1B4B35'} sx={{ my: 0.5 }}>
              {value ?? '—'}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {trend !== undefined && (
                trend > 0
                  ? <TrendingUp sx={{ fontSize: 14, color: '#10B981' }} />
                  : trend < 0
                    ? <TrendingDown sx={{ fontSize: 14, color: '#EF4444' }} />
                    : <Remove sx={{ fontSize: 14, color: '#9CA3AF' }} />
              )}
              {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function BarRow({ label, value, max, color, suffix = '' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <Box sx={{ mb: 1.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
        <Typography variant="caption" fontWeight={600}>{label}</Typography>
        <Typography variant="caption" color="text.secondary">{value}{suffix}</Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{ height: 6, borderRadius: 3, bgcolor: `${color}20`, '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 } }}
      />
    </Box>
  );
}

export default function CrmReportsPage() {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [leadReport, setLeadReport] = useState(null);
  const [agentReport, setAgentReport] = useState(null);
  const [pipelineReport, setPipelineReport] = useState(null);
  const [period, setPeriod] = useState('30');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      crmReports.getDashboard(),
      crmReports.getLeadReport({ period }),
      crmReports.getAgentPerformance({ period }),
      crmReports.getPipelineReport(),
    ])
      .then(([d, l, a, p]) => {
        setDashboard(d.data);
        setLeadReport(l.data);
        setAgentReport(a.data);
        setPipelineReport(p.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const totalByStatus = leadReport?.byStatus?.reduce((s, x) => s + x._count._all, 0) || 0;
  const totalBySource = leadReport?.bySource?.reduce((s, x) => s + x._count._all, 0) || 0;
  const maxAgent = agentReport?.length ? Math.max(...agentReport.map((a) => a.assigned)) : 1;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="#1B4B35">CRM Reports</Typography>
          <Typography variant="body2" color="text.secondary">Analytics and performance insights</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Period</InputLabel>
            <Select value={period} onChange={(e) => setPeriod(e.target.value)} label="Period">
              <MenuItem value="7">Last 7 days</MenuItem>
              <MenuItem value="30">Last 30 days</MenuItem>
              <MenuItem value="90">Last 90 days</MenuItem>
              <MenuItem value="365">Last 12 months</MenuItem>
            </Select>
          </FormControl>
          <Tooltip title="Refresh">
            <IconButton onClick={load} disabled={loading}><Refresh /></IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* KPI Row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { title: 'Total Leads', value: dashboard?.totalLeads?.toLocaleString(), sub: `${dashboard?.newLeads ?? 0} new this period`, color: '#1B4B35', trend: dashboard?.newLeads },
          { title: 'Pipeline Value', value: dashboard?.pipelineValue != null ? `SAR ${Number(dashboard.pipelineValue).toLocaleString()}` : '—', sub: 'Active opportunities', color: '#C9A227' },
          { title: 'Win Rate', value: dashboard?.winRate != null ? `${dashboard.winRate}%` : '—', sub: 'Closed won vs total closed', color: '#10B981' },
          { title: 'Conversion Rate', value: dashboard?.conversionRate != null ? `${dashboard.conversionRate}%` : '—', sub: 'Leads → Won', color: '#6366F1' },
        ].map((m) => (
          <Grid item xs={12} sm={6} md={3} key={m.title}>
            <MetricCard {...m} loading={loading} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* Lead Status Breakdown */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 2, height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>Leads by Status</Typography>
              {loading ? (
                <CircularProgress size={28} />
              ) : leadReport?.byStatus?.length ? (
                leadReport.byStatus.map((row) => (
                  <BarRow
                    key={row.status}
                    label={row.status.replace(/_/g, ' ')}
                    value={row._count._all}
                    max={totalByStatus}
                    color={STATUS_COLORS[row.status] || '#9CA3AF'}
                  />
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">No data</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Lead Source Breakdown */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 2, height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>Leads by Source</Typography>
              {loading ? (
                <CircularProgress size={28} />
              ) : leadReport?.bySource?.length ? (
                leadReport.bySource.map((row) => (
                  <BarRow
                    key={row.source}
                    label={row.source}
                    value={row._count._all}
                    max={totalBySource}
                    color={METRIC_COLORS[row.source] || '#9CA3AF'}
                  />
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">No data</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Monthly Trend */}
        {leadReport?.timeline?.length > 0 && (
          <Grid item xs={12}>
            <Card sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>Monthly Lead Trend</Typography>
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-end', overflowX: 'auto', pb: 1 }}>
                  {(() => {
                    const maxVal = Math.max(...leadReport.timeline.map((t) => Number(t.count)), 1);
                    return leadReport.timeline.map((t) => {
                      const h = Math.max(8, (Number(t.count) / maxVal) * 120);
                      return (
                        <Box key={`${t.month}-${t.year}`} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 48 }}>
                          <Typography variant="caption" fontWeight={700} color="#1B4B35">{t.count}</Typography>
                          <Box sx={{ width: 32, height: h, bgcolor: '#1B4B35', borderRadius: '4px 4px 0 0', mt: 0.5 }} />
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, fontSize: '0.65rem' }}>
                            {new Date(t.year, t.month - 1).toLocaleString('default', { month: 'short' })}
                          </Typography>
                        </Box>
                      );
                    });
                  })()}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Agent Performance */}
        <Grid item xs={12} md={7}>
          <Card sx={{ borderRadius: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>Agent Performance</Typography>
              {loading ? (
                <CircularProgress size={28} />
              ) : agentReport?.length ? (
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f8f9fa' }}>
                    <TableRow>
                      {['Agent', 'Assigned', 'Converted', 'Conv. Rate', 'Tasks Done'].map((h) => (
                        <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.75rem' }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {agentReport.map((a) => (
                      <TableRow key={a.agentId} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{ width: 28, height: 28, fontSize: '0.7rem', bgcolor: '#1B4B35' }}>
                              {a.agentName?.charAt(0)}
                            </Avatar>
                            <Typography variant="caption" fontWeight={600}>{a.agentName}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="caption">{a.assigned}</Typography>
                            <LinearProgress
                              variant="determinate"
                              value={maxAgent > 0 ? (a.assigned / maxAgent) * 100 : 0}
                              sx={{ height: 4, borderRadius: 2, bgcolor: '#1B4B3520', '& .MuiLinearProgress-bar': { bgcolor: '#1B4B35' } }}
                            />
                          </Box>
                        </TableCell>
                        <TableCell><Typography variant="caption">{a.converted}</Typography></TableCell>
                        <TableCell>
                          <Chip
                            label={`${a.conversionRate}%`}
                            size="small"
                            sx={{
                              fontSize: '0.68rem', height: 20,
                              bgcolor: a.conversionRate >= 20 ? '#10B98120' : '#EF444420',
                              color: a.conversionRate >= 20 ? '#10B981' : '#EF4444',
                            }}
                          />
                        </TableCell>
                        <TableCell><Typography variant="caption">{a.tasksCompleted} / {a.totalTasks}</Typography></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Typography variant="body2" color="text.secondary">No agent data available for this period.</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Pipeline Report */}
        <Grid item xs={12} md={5}>
          <Card sx={{ borderRadius: 2, height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>Pipeline Summary</Typography>
              {loading ? (
                <CircularProgress size={28} />
              ) : pipelineReport?.length ? (
                pipelineReport.map((pip) => (
                  <Box key={pip.pipelineId} sx={{ mb: 2 }}>
                    <Typography variant="body2" fontWeight={700} color="#1B4B35" gutterBottom>
                      {pip.pipelineName}
                    </Typography>
                    {pip.stages?.filter((s) => !s.isWon && !s.isLost).map((stage) => (
                      <Box key={stage.stageId} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: stage.color || '#1B4B35' }} />
                          <Typography variant="caption">{stage.stageName}</Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography variant="caption" fontWeight={700}>{stage.count} deal{stage.count !== 1 ? 's' : ''}</Typography>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.65rem' }}>
                            SAR {Number(stage.totalValue || 0).toLocaleString()}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                    <Divider sx={{ mt: 1 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 0.5 }}>
                      <Typography variant="caption" color="#10B981">Won: {pip.won}</Typography>
                      <Typography variant="caption" color="#EF4444">Lost: {pip.lost}</Typography>
                      <Typography variant="caption" color="#C9A227" fontWeight={700}>
                        SAR {Number(pip.totalWonValue || 0).toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">No pipeline data available.</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
