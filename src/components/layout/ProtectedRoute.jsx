import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useStore } from '../../store';

export function ProtectedRoute({ requireAdmin = false }) {
  const { user, isAuthLoading } = useStore();
  const location = useLocation();

  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] w-full">
        <div className="w-12 h-12 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Authenticated but requires admin role
  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  // Passed all checks
  return <Outlet />;
}
