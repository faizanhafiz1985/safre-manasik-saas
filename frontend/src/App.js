import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline, CircularProgress, Box } from '@mui/material';
import theme from './theme';
import { useAuth } from './context/AuthContext';

import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import TenantSignupPage from './pages/TenantSignupPage';
import DashboardPage from './pages/DashboardPage';
import PackagesPage from './pages/PackagesPage';
import BookingsPage from './pages/BookingsPage';
import BookingDetailPage from './pages/BookingDetailPage';
import TransportPage from './pages/TransportPage';
import CateringPage from './pages/CateringPage';
import HotelsPage from './pages/HotelsPage';
import VouchersPage from './pages/VouchersPage';
import PaymentsPage from './pages/PaymentsPage';
import UsersPage from './pages/UsersPage';
import CustomersPage from './pages/CustomersPage';
import VoucherFormsPage from './pages/VoucherFormsPage';
import RolesPage from './pages/RolesPage';
import SettingsPage from './pages/SettingsPage';
import ProfilePage from './pages/ProfilePage';
import DailySchedulePage from './pages/DailySchedulePage';
import TransportReportPage from './pages/TransportReportPage';
import SuperAdminDashboardPage from './pages/SuperAdminDashboardPage';
import SuperAdminPlansPage from './pages/SuperAdminPlansPage';
import SuperAdminApplicationsPage from './pages/SuperAdminApplicationsPage';
import SuperAdminDiagnosticsPage from './pages/SuperAdminDiagnosticsPage';
import SuperAdminHotelsPage from './pages/SuperAdminHotelsPage';
import PaymentStubPage from './pages/PaymentStubPage';
import PayPalSuccessPage from './pages/PayPalSuccessPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import CrmDashboardPage from './pages/crm/CrmDashboardPage';
import CrmLeadsPage from './pages/crm/CrmLeadsPage';
import CrmPipelinePage from './pages/crm/CrmPipelinePage';
import CrmTasksPage from './pages/crm/CrmTasksPage';
import CrmInboxPage from './pages/crm/CrmInboxPage';
import CrmReportsPage from './pages/crm/CrmReportsPage';
import CrmSettingsPage from './pages/crm/CrmSettingsPage';
import SuperAdminCrmPage from './pages/SuperAdminCrmPage';
import SuperAdminCostPage from './pages/SuperAdminCostPage';
import FleetPage from './pages/FleetPage';

// Where to send a user after login / when they hit a page they can't access.
// Base-role users keep the legacy /dashboard landing. A custom-role user (e.g.
// Driver) whose grants were trimmed lands on the first module they CAN see, so
// removing dashboard access actually takes effect. /profile is always reachable,
// so this can never loop.
function homePath(user) {
  if (user?.role === 'SUPER_ADMIN') return '/super-admin';
  if (!user?.customRoleId) return '/dashboard'; // base roles unchanged
  const perms = new Set(user.permissions || []);
  const order = [
    ['dashboard:view', '/dashboard'],
    ['fleet_trips:view', '/fleet'],
    ['fleet_dashboard:view', '/fleet'],
    ['transport:view', '/transport'],
    ['bookings:view', '/bookings'],
    ['packages:view', '/packages'],
    ['vouchers:view', '/vouchers'],
    ['voucher_forms:view', '/voucher-forms'],
    ['customers:view', '/customers'],
  ];
  for (const [p, route] of order) if (perms.has(p)) return route;
  return '/profile';
}

const PrivateRoute = ({ children, roles, perm }) => {
  const { user, loading } = useAuth();
  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress /></Box>;
  if (!user) return <Navigate to="/login" replace />;
  const perms = new Set(user.permissions || []);
  const isCustom = !!user.customRoleId;
  const home = homePath(user);
  if (roles && !roles.includes(user.role)) {
    // Base role not allowed. A user governed by a custom tenant role (e.g. Driver
    // keeps base role CUSTOMER) may still enter if they hold the required
    // feature permission — this is what lets drivers reach Transport/Fleet.
    const allowed = isCustom && perm && perms.has(perm);
    if (!allowed) return <Navigate to={home} replace />;
  } else if (perm && isCustom && !perms.has(perm)) {
    // Perm-only routes (dashboard/packages/bookings/vouchers were open to any
    // logged-in user). Enforce the grant for custom-role users only — base-role
    // users keep legacy open access (their permission set may be empty).
    return <Navigate to={home} replace />;
  }
  return children;
};

export default function App() {
  const { loading, user } = useAuth();
  if (loading) return <ThemeProvider theme={theme}><CssBaseline /><Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress size={48} /></Box></ThemeProvider>;

  const homeRoute = homePath(user);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/signup" element={<TenantSignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />
        <Route path="/payment/stub" element={<PrivateRoute><PaymentStubPage /></PrivateRoute>} />
        <Route path="/payment/paypal/success" element={<PrivateRoute><PayPalSuccessPage /></PrivateRoute>} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to={homeRoute} replace />} />
          <Route path="dashboard" element={<PrivateRoute perm="dashboard:view"><DashboardPage /></PrivateRoute>} />
          <Route path="super-admin" element={<PrivateRoute roles={['SUPER_ADMIN']}><SuperAdminDashboardPage /></PrivateRoute>} />
          <Route path="super-admin/plans" element={<PrivateRoute roles={['SUPER_ADMIN']}><SuperAdminPlansPage /></PrivateRoute>} />
          <Route path="super-admin/applications" element={<PrivateRoute roles={['SUPER_ADMIN']}><SuperAdminApplicationsPage /></PrivateRoute>} />
          <Route path="super-admin/diagnostics" element={<PrivateRoute roles={['SUPER_ADMIN']}><SuperAdminDiagnosticsPage /></PrivateRoute>} />
          <Route path="super-admin/hotels" element={<PrivateRoute roles={['SUPER_ADMIN']}><SuperAdminHotelsPage /></PrivateRoute>} />
          <Route path="super-admin/crm" element={<PrivateRoute roles={['SUPER_ADMIN']}><SuperAdminCrmPage /></PrivateRoute>} />
          <Route path="super-admin/costs" element={<PrivateRoute roles={['SUPER_ADMIN']}><SuperAdminCostPage /></PrivateRoute>} />
          <Route path="fleet" element={<PrivateRoute roles={['ADMIN', 'AGENT']} perm="fleet_trips:view"><FleetPage /></PrivateRoute>} />
          <Route path="reports/daily-schedule" element={<PrivateRoute roles={['ADMIN', 'AGENT']}><DailySchedulePage /></PrivateRoute>} />
          <Route path="reports/transport" element={<PrivateRoute roles={['ADMIN', 'AGENT']}><TransportReportPage /></PrivateRoute>} />
          <Route path="settings" element={<PrivateRoute roles={['ADMIN']}><SettingsPage /></PrivateRoute>} />
          {/* Old routes kept so existing links/bookmarks resolve to the merged page. */}
          <Route path="tenant-settings" element={<PrivateRoute roles={['ADMIN']}><SettingsPage /></PrivateRoute>} />
          <Route path="packages" element={<PrivateRoute perm="packages:view"><PackagesPage /></PrivateRoute>} />
          <Route path="bookings" element={<PrivateRoute perm="bookings:view"><BookingsPage /></PrivateRoute>} />
          <Route path="bookings/:id" element={<PrivateRoute perm="bookings:view"><BookingDetailPage /></PrivateRoute>} />
          <Route path="transport" element={<PrivateRoute roles={['ADMIN', 'AGENT']} perm="transport:view"><TransportPage /></PrivateRoute>} />
          <Route path="catering" element={<PrivateRoute roles={['ADMIN', 'AGENT']}><CateringPage /></PrivateRoute>} />
          <Route path="hotels" element={<PrivateRoute roles={['ADMIN', 'AGENT']}><HotelsPage /></PrivateRoute>} />
          <Route path="vouchers" element={<PrivateRoute perm="vouchers:view"><VouchersPage /></PrivateRoute>} />
          <Route path="voucher-forms" element={<PrivateRoute roles={['ADMIN', 'AGENT']}><VoucherFormsPage /></PrivateRoute>} />
          <Route path="roles" element={<PrivateRoute roles={['ADMIN']}><RolesPage /></PrivateRoute>} />
          <Route path="payments" element={<PrivateRoute roles={['ADMIN', 'AGENT']}><PaymentsPage /></PrivateRoute>} />
          <Route path="customers" element={<PrivateRoute roles={['ADMIN', 'AGENT']}><CustomersPage /></PrivateRoute>} />
          <Route path="users" element={<PrivateRoute roles={['ADMIN']}><UsersPage /></PrivateRoute>} />
          <Route path="config" element={<PrivateRoute roles={['ADMIN']}><SettingsPage /></PrivateRoute>} />
          <Route path="profile" element={<ProfilePage />} />
          {/* CRM Module */}
          <Route path="crm" element={<PrivateRoute roles={['ADMIN', 'AGENT']}><CrmDashboardPage /></PrivateRoute>} />
          <Route path="crm/leads" element={<PrivateRoute roles={['ADMIN', 'AGENT']}><CrmLeadsPage /></PrivateRoute>} />
          <Route path="crm/pipeline" element={<PrivateRoute roles={['ADMIN', 'AGENT']}><CrmPipelinePage /></PrivateRoute>} />
          <Route path="crm/tasks" element={<PrivateRoute roles={['ADMIN', 'AGENT']}><CrmTasksPage /></PrivateRoute>} />
          <Route path="crm/inbox" element={<PrivateRoute roles={['ADMIN', 'AGENT']}><CrmInboxPage /></PrivateRoute>} />
          <Route path="crm/reports" element={<PrivateRoute roles={['ADMIN']}><CrmReportsPage /></PrivateRoute>} />
          <Route path="crm/settings" element={<PrivateRoute roles={['ADMIN']}><CrmSettingsPage /></PrivateRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ThemeProvider>
  );
}
