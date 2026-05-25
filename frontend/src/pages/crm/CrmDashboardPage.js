import React, { useState, useEffect } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Chip, CircularProgress,
  LinearProgress, Alert, Avatar, Divider,
} from '@mui/material';
import {
  People, TrendingUp, Assignment, Inbox, CheckCircle, Warning,
  WhatsApp, Facebook, Instagram,
} from '@mui/icons-material';
import { crmReports } from '../../services/crmApi';

const MetricCard = ({ title, value, subtitle, icon, color = '#1B4B35', trend }) => (
  <Card sx={{ height: '100%', borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>{title}</Typography>
          <Typography variant="h4" fontWeight={700} color={color}>{value ?? '—'}</Typography>
          {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
          {trend !== undefined && trend !== null && (
            <Chip
              size="small"
              label={`${trend > 0 ? '+' : ''}${trend}% vs last month`}
              color={trend >= 0 ? 'success' : 'error'}
              sx={{ mt: 1, fontSize: '0.7rem' }}
            />
          )}
        </Box>
        <Avatar sx={{ bgcolor: `${color}20`, color, width: 48, height: 48 }}>
          {icon}
        </Avatar>
      </Box>
    </CardContent>
  </Card>
);

const StatusBar = ({ label, count, total, color }) => (
  <Box sx={{ mb: 1.5 }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="caption" fontWeight={600}>{count}</Typography>
    </Box>
    <LinearProgress
      variant="determinate"
      value={total > 0 ? (count / total) * 100 : 0}
      sx={{ height: 6, borderRadius: 3, bgcolor: '#f0f0f0', '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 } }}
    />
  </Box>
);

const STATUS_COLORS = {
  NEW: '#6366F1', CONTACTED: '#F59E0B', QUALIFIED: '#3B82F6',
  PROPOSAL_SENT: '#8B5CF6', NEGOTIATION: '#EC4899', CONFIRMED: '#1B4B35',
  CONVERTED: '#10B981', LOST: '#EF4444', SPAM: '#9CA3AF', FOLLOW_UP_PENDING: '#F97316',
};
const SOURCE_ICONS = { WHATSAPP: <WhatsApp fontSize="small" />, FACEBOOK: <Facebook fontSize="small" />, INSTAGRAM: <Instagram fontSize="small" /> };

export default function CrmDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    crmReports.getDashboard()
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.error || 'Failed to load CRM dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error" sx={{ m: 3 }}>{error}</Alert>;

  const { leads, pipeline, tasks, inbox } = data || {};

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight={700} color="#1B4B35" gutterBottom>CRM Dashboard</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>Overview of your leads, pipeline, and team performance</Typography>

      {/* KPI Cards */}
      <Grid container spacing={2.5} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard title="Total Leads" value={leads?.total} icon={<People />}
            subtitle={`${leads?.thisMonth || 0} this month`}
            trend={leads?.growthPct != null ? Number(leads.growthPct) : undefined}
            color="#1B4B35" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard title="Pipeline Value" value={`SAR ${Number(pipeline?.value || 0).toLocaleString()}`}
            icon={<TrendingUp />} subtitle={`${pipeline?.active || 0} active opportunities`}
            color="#C9A227" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard title="Open Tasks" value={tasks?.total}
            icon={<Assignment />} subtitle={`${tasks?.overdue || 0} overdue`}
            color={tasks?.overdue > 0 ? '#EF4444' : '#1B4B35'} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard title="Unread Messages" value={inbox?.unread}
            icon={<Inbox />} subtitle="In unified inbox"
            color={inbox?.unread > 0 ? '#F59E0B' : '#1B4B35'} />
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        {/* Lead Status Breakdown */}
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 2, height: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} gutterBottom>Lead Status</Typography>
              {(leads?.byStatus || []).map((s) => (
                <StatusBar
                  key={s.status}
                  label={s.status.replace(/_/g, ' ')}
                  count={s._count}
                  total={leads?.total || 1}
                  color={STATUS_COLORS[s.status] || '#1B4B35'}
                />
              ))}
            </CardContent>
          </Card>
        </Grid>

        {/* Lead Source */}
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 2, height: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} gutterBottom>Lead Sources</Typography>
              {(leads?.bySource || []).map((s) => (
                <Box key={s.source} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 28, height: 28, bgcolor: '#1B4B3515', color: '#1B4B35' }}>
                      {SOURCE_ICONS[s.source] || <People fontSize="small" />}
                    </Avatar>
                    <Typography variant="body2">{s.source}</Typography>
                  </Box>
                  <Chip label={s._count} size="small" sx={{ bgcolor: '#1B4B3515', color: '#1B4B35', fontWeight: 700 }} />
                </Box>
              ))}
              {(!leads?.bySource || leads.bySource.length === 0) && (
                <Typography variant="body2" color="text.secondary">No data yet</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Pipeline Summary */}
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 2, height: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} gutterBottom>Pipeline Summary</Typography>
              {[
                { label: 'Active Deals', value: pipeline?.active || 0, icon: <TrendingUp />, color: '#3B82F6' },
                { label: 'Won Deals', value: pipeline?.won || 0, icon: <CheckCircle />, color: '#10B981' },
                { label: 'Lost Deals', value: pipeline?.lost || 0, icon: <Warning />, color: '#EF4444' },
              ].map((item) => (
                <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar sx={{ width: 32, height: 32, bgcolor: `${item.color}15`, color: item.color }}>
                      {item.icon}
                    </Avatar>
                    <Typography variant="body2">{item.label}</Typography>
                  </Box>
                  <Typography variant="h6" fontWeight={700} color={item.color}>{item.value}</Typography>
                </Box>
              ))}
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">Win Rate</Typography>
                <Typography variant="h6" fontWeight={700} color="#10B981">{pipeline?.winRate || 0}%</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                <Typography variant="body2" color="text.secondary">Conversion Rate</Typography>
                <Typography variant="h6" fontWeight={700} color="#1B4B35">{leads?.conversionRate || 0}%</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Tasks Status */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} gutterBottom>Task Overview</Typography>
              <Grid container spacing={2}>
                {[
                  { label: 'Today', value: tasks?.today || 0, color: '#3B82F6' },
                  { label: 'Overdue', value: tasks?.overdue || 0, color: '#EF4444' },
                  { label: 'Total Open', value: tasks?.total || 0, color: '#1B4B35' },
                ].map((t) => (
                  <Grid item xs={4} key={t.label}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: `${t.color}08`, borderRadius: 2 }}>
                      <Typography variant="h4" fontWeight={700} color={t.color}>{t.value}</Typography>
                      <Typography variant="caption" color="text.secondary">{t.label}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
