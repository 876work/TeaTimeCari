import { useAuth, type UserRole } from '@/contexts/AuthContext';

export function RoleGuard({ roles, children, fallback = null }: { roles: UserRole[]; children: React.ReactNode; fallback?: React.ReactNode }) {
  const { role, profile } = useAuth();
  if (!role || profile?.status !== 'active' || !roles.includes(role)) return <>{fallback}</>;
  return <>{children}</>;
}
