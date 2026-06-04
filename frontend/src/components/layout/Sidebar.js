import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, List, ListItem, ListItemIcon, ListItemText, Typography, Divider } from '@mui/material';
import {
  Dashboard, CardTravel, BookOnline, DirectionsBus, Restaurant,
  Hotel, ConfirmationNumber, Payment, People, Settings, BarChart, EventNote,
  SupervisorAccount, Business, Campaign, Leaderboard, ViewKanban,
  AssignmentTurnedIn, Inbox, Tune, AdminPanelSettings, Receipt, Security,
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import BrandLogo from '../BrandLogo';

const navItems = [
  // Super admin only
  { label: 'Platform Admin',  icon: <SupervisorAccount />, path: '/super-admin',               roles: ['SUPER_ADMIN'], section: 'platform' },
  { label: 'Applications',    icon: <EventNote />,          path: '/super-admin/applications',  roles: ['SUPER_ADMIN'], section: 'platform' },
  { label: 'Plans & Pricing', icon: <BarChart />,           path: '/super-admin/plans',         roles: ['SUPER_ADMIN'], section: 'platform' },
  { label: 'Seed Hotels',     icon: <Hotel />,              path: '/super-admin/hotels',        roles: ['SUPER_ADMIN'], section: 'platform' },
  { label: 'Diagnostics',     icon: <Settings />,           path: '/super-admin/diagnostics',   roles: ['SUPER_ADMIN'], section: 'platform' },
  { label: 'CRM Management',  icon: <AdminPanelSettings />, path: '/super-admin/crm',           roles: ['SUPER_ADMIN'], section: 'platform' },

  // Tenant operational (each carries a `feature` key for permission-driven visibility)
  { label: 'Dashboard',       icon: <Dashboard />,          path: '/dashboard',                 roles: ['ADMIN','AGENT','CUSTOMER'], feature: 'dashboard' },
  { label: 'Daily Schedule',  icon: <EventNote />,          path: '/reports/daily-schedule',    roles: ['ADMIN','AGENT'], feature: 'daily_schedule' },
  { label: 'Transport Report',icon: <BarChart />,           path: '/reports/transport',         roles: ['ADMIN','AGENT'], feature: 'transport_report' },

  { label: 'Packages',        icon: <CardTravel />,         path: '/packages',                  roles: ['ADMIN','AGENT','CUSTOMER'], feature: 'packages' },
  { label: 'Bookings',        icon: <BookOnline />,         path: '/bookings',                  roles: ['ADMIN','AGENT','CUSTOMER'], feature: 'bookings' },
  { label: 'Vouchers',        icon: <ConfirmationNumber />, path: '/vouchers',                  roles: ['ADMIN','AGENT','CUSTOMER'], feature: 'vouchers' },
  { label: 'Direct Vouchers', icon: <Receipt />,            path: '/voucher-forms',             roles: ['ADMIN','AGENT'], feature: 'voucher_forms' },
  { label: 'Transport',       icon: <DirectionsBus />,      path: '/transport',                 roles: ['ADMIN','AGENT'], feature: 'transport' },
  { label: 'Catering',        icon: <Restaurant />,         path: '/catering',                  roles: ['ADMIN','AGENT'], feature: 'catering' },
  { label: 'Hotels',          icon: <Hotel />,              path: '/hotels',                    roles: ['ADMIN','AGENT'], feature: 'hotels' },
  { label: 'Payments',        icon: <Payment />,            path: '/payments',                  roles: ['ADMIN','AGENT'], feature: 'payments' },
  { label: 'Customers',       icon: <People />,             path: '/customers',                 roles: ['ADMIN', 'AGENT'], feature: 'customers' },
  { label: 'Users',           icon: <People />,             path: '/users',                     roles: ['ADMIN'], feature: 'users' },
  { label: 'Roles & Permissions', icon: <Security />,       path: '/roles',                     roles: ['ADMIN'], feature: 'roles' },

  // CRM Module
  { label: 'CRM Overview',    icon: <Campaign />,           path: '/crm',                       roles: ['ADMIN','AGENT'], section: 'crm', feature: 'crm_overview' },
  { label: 'Leads',           icon: <Leaderboard />,        path: '/crm/leads',                 roles: ['ADMIN','AGENT'], section: 'crm', feature: 'crm_leads' },
  { label: 'Pipeline',        icon: <ViewKanban />,         path: '/crm/pipeline',              roles: ['ADMIN','AGENT'], section: 'crm', feature: 'crm_pipeline' },
  { label: 'Tasks',           icon: <AssignmentTurnedIn />, path: '/crm/tasks',                 roles: ['ADMIN','AGENT'], section: 'crm', feature: 'crm_tasks' },
  { label: 'Inbox',           icon: <Inbox />,              path: '/crm/inbox',                 roles: ['ADMIN','AGENT'], section: 'crm', feature: 'crm_inbox' },
  { label: 'CRM Reports',     icon: <BarChart />,           path: '/crm/reports',               roles: ['ADMIN'], section: 'crm', feature: 'crm_reports' },
  { label: 'Integrations',    icon: <Tune />,               path: '/crm/settings',              roles: ['ADMIN'], section: 'crm', feature: 'crm_settings' },

  // Admin
  { label: 'Tenant Settings', icon: <Business />,           path: '/tenant-settings',           roles: ['ADMIN'], feature: 'tenant_settings' },
  { label: 'System Config',   icon: <Settings />,           path: '/config',                    roles: ['ADMIN'], feature: 'system_config' },
];

const roleLabel = {
  SUPER_ADMIN: 'Platform Super Admin',
  ADMIN: 'Administrator',
  AGENT: 'Travel Agent',
  CUSTOMER: 'Pilgrim',
};
const roleChipColor = {
  SUPER_ADMIN: '#9B59B6',
  ADMIN: '#C9A227',
  AGENT: '#4A90D9',
  CUSTOMER: '#2E9E6B',
};

export default function Sidebar({ onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Permission-driven visibility. If the server sent an effective permission set
  // (RBAC active), a tab shows only when the user has `${feature}:view`. The
  // legacy role array stays as a backstop. If no permissions are present
  // (older sessions / resolver unavailable), we fall back to pure role gating
  // so behaviour is unchanged.
  const perms = new Set(user?.permissions || []);
  const hasPerms = perms.size > 0;
  const filtered = navItems.filter(item => {
    if (!item.roles.includes(user?.role)) return false;          // role backstop
    if (item.section === 'platform') return true;                // platform tabs: role only
    if (hasPerms && item.feature) return perms.has(`${item.feature}:view`);
    return true;                                                 // fallback: role-based
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#0D2B1A' }}>
      <Box sx={{ px: 2, pt: 2, pb: 1.5, borderBottom: '1px solid rgba(201,162,39,0.25)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Box sx={{ bgcolor: 'rgba(255,255,255,0.95)', borderRadius: 2, px: 1.5, py: 1, width: '100%' }}>
            {/* BrandLogo picks the tenant's logoUrl (if set) or the platform default,
                so a tenant who uploads their own logo sees their own brand here. */}
            <BrandLogo variant="compact" maxWidth={210} maxHeight={75} sx={{ width: '100%' }} />
            <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: '#1B4B35', fontWeight: 700, fontSize: '0.7rem', mt: 0.3 }}>
              {user?.tenant?.name && user.tenant.name !== 'Safre Manasik'
                ? user.tenant.name
                : 'Safre Manasik SaaS'}
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          bgcolor: 'rgba(201,162,39,0.15)', border: '1px solid rgba(201,162,39,0.3)',
          borderRadius: 2, px: 1.5, py: 0.5,
        }}>
          <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: roleChipColor[user?.role], display:'flex', alignItems:'center', justifyContent:'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {user?.name?.charAt(0)}
          </Box>
          <Box sx={{ overflow: 'hidden', flex: 1 }}>
            <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700, display: 'block', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name}
            </Typography>
            <Typography variant="caption" sx={{ color: '#C9A227', fontSize: '0.65rem', fontWeight: 600 }}>
              {roleLabel[user?.role]}
            </Typography>
          </Box>
        </Box>
        {user?.tenant && (
          <Box sx={{ mt: 1, px: 1 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem' }}>Tenant</Typography>
            <Typography variant="caption" sx={{ color: '#fff', display: 'block', fontWeight: 600 }}>
              {user.tenant.name}
            </Typography>
          </Box>
        )}
      </Box>

      <List sx={{ px: 1.5, pt: 1, flexGrow: 1 }}>
        {filtered.map((item, idx) => {
          const active = location.pathname === item.path || (item.path !== '/crm' && location.pathname.startsWith(item.path + '/'));
          const prevItem = filtered[idx - 1];
          const showCrmDivider = item.section === 'crm' && prevItem?.section !== 'crm';
          return (
            <React.Fragment key={item.path}>
              {showCrmDivider && (
                <Box sx={{ px: 1, pt: 1.5, pb: 0.5 }}>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.10)', mb: 1 }} />
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)', fontWeight: 700, fontSize: '0.62rem', letterSpacing: 1, textTransform: 'uppercase' }}>
                    CRM
                  </Typography>
                </Box>
              )}
              <ListItem
                button
                onClick={() => { navigate(item.path); onClose?.(); }}
                sx={{
                  borderRadius: 2, mb: 0.5,
                  bgcolor: active ? 'rgba(201,162,39,0.18)' : 'transparent',
                  borderLeft: active ? '3px solid #C9A227' : '3px solid transparent',
                  color: active ? '#C9A227' : 'rgba(255,255,255,0.75)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', color: '#fff' },
                  py: 0.9,
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}>
                  {React.cloneElement(item.icon, { fontSize: 'small' })}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: active ? 700 : 500 }}
                />
              </ListItem>
            </React.Fragment>
          );
        })}
      </List>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.65rem' }}>
          Safre Manasik SaaS v2.0
        </Typography>
      </Box>
    </Box>
  );
}
