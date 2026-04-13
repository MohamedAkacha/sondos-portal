import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import LoadingScreen from '@/components/common/LoadingScreen';
import AppLayout from '@/components/layout/AppLayout';
import AdminLayout from '@/components/layout/AdminLayout';
import LoginPage from '@/pages/auth/LoginPage';
import AdminLoginPage from '@/pages/auth/AdminLoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import OverviewPage from '@/pages/client/OverviewPage';
import CallsPage from '@/pages/client/CallsPage';
import CallDetailPage from '@/pages/client/CallDetailPage';
import LiveCallsPage from '@/pages/client/LiveCallsPage';
import LeadsPage from '@/pages/client/LeadsPage';
import LeadDetailPage from '@/pages/client/LeadDetailPage';
import KnowledgePage from '@/pages/client/KnowledgePage';
import KnowledgeBasePage from '@/pages/client/KnowledgeBasePage';
import ChatSessionsPage from '@/pages/client/ChatSessionsPage';
import ChatSessionDetailPage from '@/pages/client/ChatSessionDetailPage';
import AnalyticsPage from '@/pages/client/AnalyticsPage';
import UsagePage from '@/pages/client/UsagePage';
import HandoffQueuePage from '@/pages/client/HandoffQueuePage';
import ExtractionsPage from '@/pages/client/ExtractionsPage';
import MemoryPage from '@/pages/client/MemoryPage';
import APIKeysPage from '@/pages/client/APIKeysPage';
import WebhooksPage from '@/pages/client/WebhooksPage';
import WidgetSetupPage from '@/pages/client/WidgetSetupPage';
import SettingsPage from '@/pages/client/SettingsPage';
import IntegrationsPage from '@/pages/client/IntegrationsPage';
import PaymentPage from '@/pages/client/PaymentPage';
import PaymentCallbackPage from '@/pages/client/PaymentCallbackPage';
import PaymentHistoryPage from '@/pages/client/PaymentHistoryPage';
import TestAgentPage from '@/pages/client/TestAgentPage';
import MyPlanPage from '@/pages/client/MyPlanPage';
import AgentsPage from '@/pages/client/AgentsPage';
import AgentSettingsPage from '@/pages/client/AgentSettingsPage';
import CreateAgentPage from '@/pages/client/CreateAgentPage';
import PhoneNumbersPage from '@/pages/client/PhoneNumbersPage';
import CampaignsPage from '@/pages/client/CampaignsPage';
import VoiceClonePage from '@/pages/client/VoiceClonePage';
import ToolsPage from '@/pages/client/ToolsPage';
import CreateToolPage from '@/pages/client/CreateToolPage';
import AdminDashboardPage from '@/pages/admin/AdminDashboardPage';
import AdminClientsPage from '@/pages/admin/AdminClientsPage';
import AdminPlansPage from '@/pages/admin/AdminPlansPage';
import AdminReportsPage from '@/pages/admin/AdminReportsPage';
import AdminSettingsPage from '@/pages/admin/AdminSettingsPage';

function GuestOnly({ children }) { const { isAuthenticated, isLoading, userType } = useAuth(); if (isLoading) return <LoadingScreen />; if (isAuthenticated) return <Navigate to={userType === 'admin' ? '/admin' : '/'} replace />; return children; }
function RequireAuth({ children }) { const { isAuthenticated, isLoading } = useAuth(); if (isLoading) return <LoadingScreen />; if (!isAuthenticated) return <Navigate to="/login" replace />; return children; }
function RequireAdmin({ children }) { const { isAuthenticated, isLoading, userType } = useAuth(); if (isLoading) return <LoadingScreen />; if (!isAuthenticated) return <Navigate to="/admin/login" replace />; if (userType !== 'admin') return <Navigate to="/" replace />; return children; }

export default function Router() {
  return (
    <BrowserRouter><Routes>
      <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
      <Route path="/admin/login" element={<GuestOnly><AdminLoginPage /></GuestOnly>} />
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<OverviewPage />} />
        <Route path="calls" element={<CallsPage />} />
        <Route path="calls/:id" element={<CallDetailPage />} />
        <Route path="live-calls" element={<LiveCallsPage />} />
        <Route path="leads" element={<LeadsPage />} />
        <Route path="leads/:id" element={<LeadDetailPage />} />
        <Route path="knowledge" element={<KnowledgePage />} />
        <Route path="knowledge/:id" element={<KnowledgeBasePage />} />
        <Route path="chat" element={<ChatSessionsPage />} />
        <Route path="chat/:id" element={<ChatSessionDetailPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="usage" element={<UsagePage />} />
        <Route path="handoff" element={<HandoffQueuePage />} />
        <Route path="extractions" element={<ExtractionsPage />} />
        <Route path="memory" element={<MemoryPage />} />
        <Route path="api-keys" element={<APIKeysPage />} />
        <Route path="webhooks" element={<WebhooksPage />} />
        <Route path="widget-setup" element={<WidgetSetupPage />} />
        <Route path="integrations" element={<IntegrationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="my-plan" element={<MyPlanPage />} />
        <Route path="payment" element={<PaymentPage />} />
        <Route path="payment/callback" element={<PaymentCallbackPage />} />
        <Route path="payment/history" element={<PaymentHistoryPage />} />
        <Route path="test-agent" element={<TestAgentPage />} />
        <Route path="agents" element={<AgentsPage />} />
        <Route path="agents/new" element={<CreateAgentPage />} />
        <Route path="agents/:id" element={<AgentSettingsPage />} />
        <Route path="phones" element={<PhoneNumbersPage />} />
        <Route path="campaigns" element={<CampaignsPage />} />
        <Route path="voice-clone" element={<VoiceClonePage />} />
        <Route path="tools" element={<ToolsPage />} />
        <Route path="tools/create" element={<CreateToolPage />} />
        {/* Redirects — merged pages */}
        <Route path="dashboard" element={<Navigate to="/analytics" replace />} />
        <Route path="assistant" element={<Navigate to="/agents" replace />} />
        <Route path="balance" element={<Navigate to="/usage" replace />} />
        <Route path="api-settings" element={<Navigate to="/api-keys" replace />} />
      </Route>
      <Route path="admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="clients" element={<AdminClientsPage />} />
        <Route path="plans" element={<AdminPlansPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes></BrowserRouter>
  );
}