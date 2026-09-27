import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as authApi from '@/api/auth';
import { clearToken, getToken, setToken } from '@/api/session';
import { keys } from '@/api/keys';
import type { LoginRequest, RegisterRequest, User } from '@/api/types';
import { AuthContext, type AuthState } from './authContext';

/** Session owner: validates the stored token on load, and drops the user when the client reports a 401. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<{ user: User | null; loading: boolean }>(() => ({
    user: null,
    loading: getToken() !== null,
  }));

  useEffect(() => {
    if (!getToken()) return;
    let live = true;
    authApi
      .getCurrentUser()
      .then((user) => live && setSession({ user, loading: false }))
      .catch(() => {
        clearToken();
        if (live) setSession({ user: null, loading: false });
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const onEnded = () => setSession({ user: null, loading: false });
    window.addEventListener('moc:session-ended', onEnded);
    return () => window.removeEventListener('moc:session-ended', onEnded);
  }, []);

  const login = useCallback(
    async (credentials: LoginRequest) => {
      const res = await authApi.login(credentials);
      setToken(res.token);
      qc.setQueryData(keys.me, res.user);
      setSession({ user: res.user, loading: false });
    },
    [qc]
  );

  const register = useCallback(
    async (data: RegisterRequest) => {
      const res = await authApi.register(data);
      setToken(res.token);
      qc.setQueryData(keys.me, res.user);
      setSession({ user: res.user, loading: false });
    },
    [qc]
  );

  const logout = useCallback(() => {
    clearToken();
    void authApi.logout();
    qc.clear();
    setSession({ user: null, loading: false });
  }, [qc]);

  const updateUser = useCallback(
    (user: User) => {
      qc.setQueryData(keys.me, user);
      setSession((s) => ({ ...s, user }));
    },
    [qc]
  );

  const value = useMemo<AuthState>(
    () => ({
      user: session.user,
      isAuthenticated: session.user !== null,
      isLoading: session.loading,
      login,
      register,
      logout,
      updateUser,
    }),
    [session, login, register, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
