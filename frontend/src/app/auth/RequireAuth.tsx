import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { loginUrlFor } from '@/api/session';
import { useAuth } from './authContext';
import { BootScreen } from './BootScreen';

/** Gate for every signed-in route. Unauthenticated users go to /login?from=<here>. */
export function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <BootScreen label="Checking session" />;
  if (!isAuthenticated) return <Navigate to={loginUrlFor(location)} replace />;
  return <Outlet />;
}
