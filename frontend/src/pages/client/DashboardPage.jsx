import { Navigate } from 'react-router-dom';
// v2: Merged into /analytics. OverviewPage (/) for quick stats, AnalyticsPage for detailed charts.
export default function DashboardPage() {
  return <Navigate to="/analytics" replace />;
}
