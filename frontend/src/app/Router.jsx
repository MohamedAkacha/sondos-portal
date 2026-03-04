import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import LoadingScreen from '@/components/common/LoadingScreen';

// Layouts
import AppLayout from '@/components/layout/AppLayout';
import AdminLayout from '@/components/layout/AdminLayout';

// Auth pages
import LoginPage from '@/pages/auth/LoginPage';
import AdminLoginPage from '@/pages/auth/AdminLoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';

// Client pages
import OverviewPage from '@/pages/client/OverviewPage';
import DashboardPage from '@/pages/client/DashboardPage';
import CallsPage from '@/pages/client/CallsPage';
import LeadsPage from '@/pages/client/LeadsPage';
import KnowledgePage from '@/pages/client/KnowledgePage';
import SettingsPage from '@/pages/client/SettingsPage';
import IntegrationsPage from '@/pages/client/IntegrationsPage';
import AssistantSettingsPage from '@/pages/client/AssistantSettingsPage';
import PaymentPage from '@/pages/client/PaymentPage';
import PaymentCallbackPage from '@/pages/client/PaymentCallbackPage';
import PaymentHistoryPage from '@/pages/client/PaymentHistoryPage';

// Admin pages
import AdminDashboardPage from '@/pages/admin/AdminDashboardPage';
import AdminClientsPage from '@/pages/admin/AdminClientsPage';
import AdminPlansPage from '@/pages/admin/AdminPlansPage';
import AdminReportsPage from '@/pages/admin/AdminReportsPage';
import AdminSettingsPage from '@/pages/admin/AdminSettingsPage';

// ── Route Guards ──

function GuestOnly({ children }) {
  const { isAuthenticated, isLoading, userType } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (isAuthenticated) {
    return <Navigate to={userType === 'admin' ? '/admin' : '/'} replace />;
  }
  return children;
}

function RequireAuth({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function RequireAdmin({ children }) {
  const { isAuthenticated, isLoading, userType } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;
  if (userType !== 'admin') return <Navigate to="/" replace />;
  return children;
}

// ── Router ──

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Auth routes (guests only) ── */}
        <Route path="/login"        element={<GuestOnly><LoginPage /></GuestOnly>} />
        <Route path="/register"     element={<GuestOnly><RegisterPage /></GuestOnly>} />
        <Route path="/admin/login"  element={<GuestOnly><AdminLoginPage /></GuestOnly>} />

        {/* ── Client routes ── */}
        <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index                    element={<OverviewPage />} />
          <Route path="dashboard"         element={<DashboardPage />} />
          <Route path="calls"             element={<CallsPage />} />
          <Route path="leads"             element={<LeadsPage />} />
          <Route path="knowledge"         element={<KnowledgePage />} />
          <Route path="assistant"         element={<AssistantSettingsPage />} />
          <Route path="integrations"      element={<IntegrationsPage />} />
          <Route path="settings"          element={<SettingsPage />} />
          <Route path="payment"           element={<PaymentPage />} />
          <Route path="payment/callback"  element={<PaymentCallbackPage />} />
          <Route path="payment/history"   element={<PaymentHistoryPage />} />

          {/* Redirects: old routes → settings tabs */}
          <Route path="balance"      element={<Navigate to="/settings?tab=balance" replace />} />
          <Route path="api-settings" element={<Navigate to="/settings?tab=api"     replace />} />
        </Route>

        {/* ── Admin routes ── */}
        <Route path="admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
          <Route index           element={<AdminDashboardPage />} />
          <Route path="clients"  element={<AdminClientsPage />} />
          <Route path="plans"    element={<AdminPlansPage />} />
          <Route path="reports"  element={<AdminReportsPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
        </Route>

        {/* ── Fallback ── */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}