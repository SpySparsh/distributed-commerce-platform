import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminRoute({ children }) {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin') || user?.permissions?.includes('search:admin');

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }
  return children;
}
