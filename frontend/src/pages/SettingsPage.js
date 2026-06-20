import React, { useState } from 'react';
import { Box, Tabs, Tab, Paper } from '@mui/material';
import { Business, Settings as SettingsIcon } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import TenantSettingsPage from './TenantSettingsPage';
import AdminConfigPage from './AdminConfigPage';

// Merged Settings screen: combines the former "Tenant Settings" and "System
// Config" tabs into one. The two existing pages are reused unchanged as tab
// panels, so all their behaviour is preserved.
export default function SettingsPage() {
  const { user } = useAuth();
  const perms = new Set(user?.permissions || []);
  const hasPerms = perms.size > 0;
  const canTenant = !hasPerms || perms.has('tenant_settings:view');
  const canSystem = !hasPerms || perms.has('system_config:view');

  // Build the visible tab set based on permissions (admins see both).
  const tabs = [];
  if (canTenant) tabs.push({ key: 'tenant', label: 'Tenant Settings', icon: <Business fontSize="small" />, render: () => <TenantSettingsPage /> });
  if (canSystem) tabs.push({ key: 'system', label: 'System Config', icon: <SettingsIcon fontSize="small" />, render: () => <AdminConfigPage /> });
  if (tabs.length === 0) tabs.push({ key: 'tenant', label: 'Tenant Settings', icon: <Business fontSize="small" />, render: () => <TenantSettingsPage /> });

  const [tab, setTab] = useState(0);
  const safeTab = Math.min(tab, tabs.length - 1);

  return (
    <Box>
      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={safeTab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          {tabs.map((t) => (
            <Tab key={t.key} icon={t.icon} iconPosition="start" label={t.label} sx={{ minHeight: 56, fontWeight: 600 }} />
          ))}
        </Tabs>
      </Paper>
      <Box sx={{ mt: 1 }}>{tabs[safeTab].render()}</Box>
    </Box>
  );
}
