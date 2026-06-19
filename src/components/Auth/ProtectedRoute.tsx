import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, type UserRole } from '@/contexts/AuthContext';
import { AuthLoading } from './AuthLoading';

const defaultDestination: Record<UserRole, string> = {
  business: '/business/dashboard',
  creator: '/creator/dashboard',
  admin: '/admin',
};

export function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: UserRole[] }) {
  const { isLoading, isAuthenticated, profile, profileError, role } = useAuth();
  const location = useLocation();

  if (isLoading) return <AuthLoading />;
  if (!isAuthenticated) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (profile?.status === 'suspended') return <Navigate to="/account/suspended" replace />;
  if (profile?.status === 'deleted') return <Navigate to="/account/unavailable" replace />;
  if (profileError || !profile || !role) return <Navigate to="/account/setup-error" replace />;
  if (roles && !roles.includes(role)) return <Navigate to={defaultDestination[role]} replace />;

  return <>{children}</>;
}
