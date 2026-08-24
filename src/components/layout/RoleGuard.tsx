import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';
import type { Role } from '../../lib/database.types';

/**
 * Client-side route gating for UX only (hiding/redirecting away from screens
 * a role shouldn't see). This is NOT the security boundary - RLS policies
 * (supabase/migrations/0002_rls_policies.sql) are what actually enforce
 * access to data, since a determined user can bypass client-side routing.
 */
export function RoleGuard({ allow, children }: { allow: Role[]; children: ReactNode }) {
  const { session, profile, loading } = useAuth();

  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) return null; // profile still loading/failed; AppShell surfaces the error
  if (!allow.includes(profile.role)) return <Navigate to="/" replace />;

  return <>{children}</>;
}
