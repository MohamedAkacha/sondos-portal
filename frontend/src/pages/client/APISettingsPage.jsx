import { Navigate } from 'react-router-dom';
// v2: API settings merged into /api-keys page
export default function APISettingsPage() {
  return <Navigate to="/api-keys" replace />;
}
