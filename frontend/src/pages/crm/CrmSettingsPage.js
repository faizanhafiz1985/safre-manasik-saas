import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, TextField, Button,
  Switch, FormControlLabel, Chip, Alert, CircularProgress, Divider,
  Tabs, Tab, Snackbar, IconButton, Tooltip, List, ListItem,
  ListItemText, ListItemIcon,
} from '@mui/material';
import { WhatsApp, Facebook, Instagram, ContentCopy, Refresh, Check } from '@mui/icons-material';
import { crmIntegrations, crmAutomation } from '../../services/crmApi';

const INTEGRATION_CONFIGS = {
  WHATSAPP: {
    icon: <WhatsApp sx={{ color: '#25D366' }} />,
    color: '#25D366',
    label: 'WhatsApp Business API',
    description: 'Receive WhatsApp messages and auto-create leads from inquiries',
    fields: [
      { key: 'phoneNumberId', label: 'Phone Number ID', hint: 'From Meta Developer Console → WhatsApp → API Setup' },
      { key: 'accessToken', label: 'Access Token', hint: 'System User Access Token with whatsapp_business_messaging permission' },
      { key: 'appSecret', label: 'App Secret', hint: 'Meta App Secret for webhook signature verification' },
    ],
  },
  FACEBOOK: {
    icon: <Facebook sx={{ color: '#1877F2' }} />,
    color: '#1877F2',
    label: 'Facebook Lead Ads',
    description: 'Automatically sync leads from Facebook Lead Ad forms in real-time',
    fields: [
      { key: 'pageId', label: 'Page ID', hint: 'Your Facebook Page ID' },
      { key: 'accessToken', label: 'Page Access Token', hint: 'Long-lived Page Access Token with leads_retrieval permission' },
      { key: 'appSecret', label: 'App Secret', hint: 'Meta App Secret for signature verification' },
    ],
  },
  INSTAGRAM: {
    icon: <Instagram sx={{ color: '#E4405F' }} />,
    color: '#E4405F',
    label: 'Instagram Business',
    description: 'Capture leads from Instagram DMs and Lead Ads',
    fields: [
      { key: 'pageId', label: 'Instagram Business Account ID', hint: 'Connected to your Facebook Page ID' },
      { key: 'accessToken', label: 'Access Token', hint: 'Page Access Token with instagram_manage_messages permission' },
      { key: 'appSecret', label: 'App Secret', hint: 'Meta App Secret for signature verification' },
    ],
  },
};

const RULE_TEMPLATES = [
  { name: 'Auto-assign WhatsApp leads', trigger: 'lead_created', conditions: [{ field: 'source', operator: 'eq', value: 'WHATSAPP' }], actions: [{ type: 'create_task', params: { title: 'Follow up WhatsApp inquiry', priority: 'HIGH', dueDays: 1 } }] },
  { name: 'Tag Facebook leads', trigger: 'lead_created', conditions: [{ field: 'source', operator: 'eq', value: 'FACEBOOK' }], actions: [{ type: 'add_tag', params: { tag: 'facebook-ad' } }] },
  { name: 'Create follow-up for qualified leads', trigger: 'lead_status_changed', conditions: [{ field: 'status', operator: 'eq', value: 'QUALIFIED' }], actions: [{ type: 'create_task', params: { title: 'Send proposal', priority: 'HIGH', dueDays: 2 } }] },
];

function IntegrationPanel({ type }) {
  const config = INTEGRATION_CONFIGS[type];
  const [integration, setIntegration] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    crmIntegrations.getAll()
      .then((r) => {
        const found = r.data.find((i) => i.type === type);
        if (found) { setIntegration(found); setForm(found.credentials || {}); }
      })
      .finally(() => setLoading(false));
  }, [type]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await crmIntegrations.upsert({ type, credentials: form });
      // Refresh
      const r = await crmIntegrations.getAll();
      const found = r.data.find((i) => i.type === type);
      if (found) setIntegration(found);
      setSnackbar({ open: true, message: 'Integration saved', severity: 'success' });
    } catch (e) {
      setSnackbar({ open: true, message: e.response?.data?.error || 'Failed to save', severity: 'error' });
    } finally { setSaving(false); }
  };

  const handleToggle = async (enabled) => {
    if (!integration) return;
    try {
      await crmIntegrations.toggle(integration.id, enabled);
      setIntegration((prev) => ({ ...prev, isEnabled: enabled }));
      setSnackbar({ open: true, message: enabled ? 'Integration enabled' : 'Integration disabled', severity: 'success' });
    } catch { setSnackbar({ open: true, message: 'Failed', severity: 'error' }); }
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(field); setTimeout(() => setCopied(''), 2000); });
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {config.icon}
          <Box>
            <Typography variant="h6" fontWeight={700}>{config.label}</Typography>
            <Typography variant="caption" color="text.secondary">{config.description}</Typography>
          </Box>
        </Box>
        {integration && (
          <FormControlLabel
            control={<Switch checked={integration.isEnabled} onChange={(e) => handleToggle(e.target.checked)} color="success" />}
            label={integration.isEnabled ? 'Enabled' : 'Disabled'}
          />
        )}
      </Box>

      {/* Webhook URL */}
      {integration?.webhookUrl && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2" fontWeight={700} gutterBottom>Webhook URL — Copy this to Meta Developer Console</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#fff', p: 1, borderRadius: 1, mt: 0.5 }}>
            <Typography variant="caption" sx={{ flex: 1, fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {integration.webhookUrl}
            </Typography>
            <IconButton size="small" onClick={() => copyToClipboard(integration.webhookUrl, 'url')}>
              {copied === 'url' ? <Check fontSize="small" color="success" /> : <ContentCopy fontSize="small" />}
            </IconButton>
          </Box>
          {integration.webhookSecret && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              <Typography variant="caption" fontWeight={700}>Verify Token:</Typography>
              <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{integration.webhookSecret.substring(0, 16)}...</Typography>
              <IconButton size="small" onClick={() => copyToClipboard(integration.webhookSecret, 'secret')}>
                {copied === 'secret' ? <Check fontSize="small" color="success" /> : <ContentCopy fontSize="small" />}
              </IconButton>
            </Box>
          )}
        </Alert>
      )}

      {/* Credential fields */}
      <Grid container spacing={2}>
        {config.fields.map((f) => (
          <Grid item xs={12} key={f.key}>
            <TextField
              fullWidth size="small"
              label={f.label}
              value={form[f.key] || ''}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              helperText={f.hint}
              type={f.key.toLowerCase().includes('token') || f.key.toLowerCase().includes('secret') ? 'password' : 'text'}
            />
          </Grid>
        ))}
        <Grid item xs={12}>
          <Button variant="contained" onClick={handleSave} disabled={saving}
            sx={{ bgcolor: config.color, '&:hover': { bgcolor: config.color, filter: 'brightness(0.9)' } }}>
            {saving ? <CircularProgress size={18} color="inherit" /> : integration ? 'Update Credentials' : 'Save & Connect'}
          </Button>
        </Grid>
      </Grid>

      {integration?.lastError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          <Typography variant="body2" fontWeight={700}>Last Error</Typography>
          <Typography variant="caption">{integration.lastError}</Typography>
        </Alert>
      )}

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}

function AutomationPanel() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const load = () => {
    setLoading(true);
    crmAutomation.getAll()
      .then((r) => setRules(r.data))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleToggle = async (rule) => {
    try {
      await crmAutomation.toggle(rule.id);
      setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, isActive: !r.isActive } : r));
    } catch { setSnackbar({ open: true, message: 'Failed', severity: 'error' }); }
  };

  const handleAddTemplate = async (template) => {
    try {
      await crmAutomation.create(template);
      setSnackbar({ open: true, message: `Rule "${template.name}" created`, severity: 'success' });
      load();
    } catch (e) {
      setSnackbar({ open: true, message: e.response?.data?.error || 'Failed', severity: 'error' });
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} gutterBottom>Automation Rules</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Rules run automatically when their trigger fires. Each rule checks its conditions and then executes the actions.
      </Typography>

      {rules.length === 0 ? (
        <Alert severity="info" sx={{ mb: 2 }}>No rules yet. Add one from the templates below.</Alert>
      ) : (
        <List sx={{ mb: 3 }}>
          {rules.map((rule) => (
            <ListItem key={rule.id} sx={{ border: '1px solid #f0f0f0', borderRadius: 2, mb: 1 }}>
              <ListItemText
                primary={<Typography variant="body2" fontWeight={700}>{rule.name}</Typography>}
                secondary={
                  <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                    <Chip label={`Trigger: ${rule.trigger}`} size="small" variant="outlined" sx={{ fontSize: '0.65rem' }} />
                    <Chip label={`Ran ${rule.runCount} times`} size="small" sx={{ fontSize: '0.65rem', bgcolor: '#f0f0f0' }} />
                  </Box>
                }
              />
              <Switch checked={rule.isActive} onChange={() => handleToggle(rule)} size="small" />
            </ListItem>
          ))}
        </List>
      )}

      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" fontWeight={700} mb={1}>Quick Templates</Typography>
      <Grid container spacing={1.5}>
        {RULE_TEMPLATES.map((t) => (
          <Grid item xs={12} sm={4} key={t.name}>
            <Card sx={{ p: 1.5, border: '1px solid #f0f0f0', cursor: 'pointer', '&:hover': { border: '1px solid #1B4B35' }, borderRadius: 2 }}
              onClick={() => handleAddTemplate(t)}>
              <Typography variant="body2" fontWeight={600}>{t.name}</Typography>
              <Typography variant="caption" color="text.secondary">Trigger: {t.trigger.replace(/_/g, ' ')}</Typography>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}

export default function CrmSettingsPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight={700} color="#1B4B35" gutterBottom>CRM Settings & Integrations</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid #f0f0f0' }}>
        <Tab label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><WhatsApp fontSize="small" sx={{ color: '#25D366' }} />WhatsApp</Box>} />
        <Tab label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><Facebook fontSize="small" sx={{ color: '#1877F2' }} />Facebook</Box>} />
        <Tab label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><Instagram fontSize="small" sx={{ color: '#E4405F' }} />Instagram</Box>} />
        <Tab label="Automation" />
      </Tabs>
      <Card sx={{ borderRadius: 2, p: 3 }}>
        {tab === 0 && <IntegrationPanel type="WHATSAPP" />}
        {tab === 1 && <IntegrationPanel type="FACEBOOK" />}
        {tab === 2 && <IntegrationPanel type="INSTAGRAM" />}
        {tab === 3 && <AutomationPanel />}
      </Card>
    </Box>
  );
}
