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
import AdminConfigPage from './pages/AdminConfigPage';
import ProfilePage from './pages/ProfilePage';
import DailySchedulePage from './pages/DailySchedulePage';
import TransportReportPage from './pages/TransportReportPage';
import SuperAdminDashboardPage from './pages/SuperAdminDashboardPage';
import SuperAdminPlansPage from './pages/SuperAdminPlansPage';
import SuperAdminApplicationsPage from './pages/SuperAdminApplicationsPage';
import SuperAdminDiagnosticsPage from './pages/SuperAdminDiagnosticsPage';
import SuperAdminHotelsPage from './pages/SuperAdminHotelsPage';
import TenantSettingsPage from './pages/TenantSettingsPage';
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

const PrivateRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress /></Box>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
};

export default function App() {
  const { loading, user } = useAuth();
  if (loading) return <ThemeProvider theme={theme}><CssBaseline /><Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress size={48} /></Box></ThemeProvider>;

  const homeRoute = user?.role === 'SUPER_ADMIN' ? '/super-admin' : '/dashboard';

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
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="super-admin" element={<PrivateRoute roles={['SUPER_ADMIN']}><SuperAdminDashboardPage /></PrivateRoute>} />
          <Route path="super-admin/plans" element={<PrivateRoute roles={['SUPER_ADMIN']}><SuperAdminPlansPage /></PrivateRoute>} />
          <Route path="super-admin/applications" element={<PrivateRoute roles={['SUPER_ADMIN']}><SuperAdminApplicationsPage /></PrivateRoute>} />
          <Route path="super-admin/diagnostics" element={<PrivateRoute roles={['SUPER_ADMIN']}><SuperAdminDiagnosticsPage /></PrivateRoute>} />
          <Route path="super-admin/hotels" element={<PrivateRoute roles={['SUPER_ADMIN']}><SuperAdminHotelsPage /></PrivateRoute>} />
          <Route path="super-admin/crm" element={<PrivateRoute roles={['SUPER_ADMIN']}><SuperAdminCrmPage /></PrivateRoute>} />
          <Route path="super-admin/costs" element={<PrivateRoute roles={['SUPER_ADMIN']}><SuperAdminCostPage /></PrivateRoute>} />
          <Route path="reports/daily-schedule" element={<PrivateRoute roles={['ADMIN', 'AGENT']}><DailySchedulePage /></PrivateRoute>} />
          <Route path="reports/transport" element={<PrivateRoute roles={['ADMIN', 'AGENT']}><TransportReportPage /></PrivateRoute>} />
          <Route path="tenant-settings" element={<PrivateRoute roles={['ADMIN']}><TenantSettingsPage /></PrivateRoute>} />
          <Route path="packages" element={<PackagesPage />} />
          <Route path="bookings" element={<BookingsPage />} />
          <Route path="bookings/:id" element={<BookingDetailPage />} />
          <Route path="transport" element={<PrivateRoute roles={['ADMIN', 'AGENT']}><TransportPage /></PrivateRoute>} />
          <Route path="catering" element={<PrivateRoute roles={['ADMIN', 'AGENT']}><CateringPage /></PrivateRoute>} />
          <Route path="hotels" element={<PrivateRoute roles={['ADMIN', 'AGENT']}><HotelsPage /></PrivateRoute>} />
          <Route path="vouchers" element={<VouchersPage />} />
          <Route path="voucher-forms" element={<PrivateRoute roles={['ADMIN', 'AGENT']}><VoucherFormsPage /></PrivateRoute>} />
          <Route path="roles" element={<PrivateRoute roles={['ADMIN']}><RolesPage /></PrivateRoute>} />
          <Route path="payments" element={<PrivateRoute roles={['ADMIN', 'AGENT']}><PaymentsPage /></PrivateRoute>} />
          <Route path="customers" element={<PrivateRoute roles={['ADMIN', 'AGENT']}><CustomersPage /></PrivateRoute>} />
          <Route path="users" element={<PrivateRoute roles={['ADMIN']}><UsersPage /></PrivateRoute>} />
          <Route path="config" element={<PrivateRoute roles={['ADMIN']}><AdminConfigPage /></PrivateRoute>} />
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
