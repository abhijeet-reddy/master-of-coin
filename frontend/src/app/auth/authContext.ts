import { createContext, useContext } from 'react';
import type { LoginRequest, RegisterRequest, User } from '@/api/types';

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  /** True until the stored token has been checked against GET /auth/me. */
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  /** Replace the session user after a profile save, so the shell shows the new name. */
  updateUser: (user: User) => void;
}

export const AuthContext = createContext<AuthState | undefined>(undefined);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
