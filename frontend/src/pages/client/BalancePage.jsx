import { Navigate } from 'react-router-dom';
// v2: Balance functionality merged into /usage page
export default function BalancePage() {
  return <Navigate to="/usage" replace />;
}
