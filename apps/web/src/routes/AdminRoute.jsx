import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminRoute({ children }) {
  const { user, isHydrating } = useAuth();
  const isAdmin = user?.roles?.includes('admin') || user?.permissions?.includes('search:admin');

  if (isHydrating) {
    return <p className="p-6">Loading session...</p>;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }
  return children;
}
