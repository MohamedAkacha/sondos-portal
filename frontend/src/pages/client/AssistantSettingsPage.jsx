import { Navigate } from 'react-router-dom';
// v2: Merged into /agents. Use AgentsPage for list, AgentSettingsPage for individual settings.
export default function AssistantSettingsPage() {
  return <Navigate to="/agents" replace />;
}
