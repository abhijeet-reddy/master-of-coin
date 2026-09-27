import { apiClient } from './client';
import type { LoginRequest, RegisterRequest, AuthResponse, User } from './types';

/**
 * Login with username and password
 */
export async function login(credentials: LoginRequest): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
  return response.data;
}

/**
 * Register a new user account
 */
export async function register(data: RegisterRequest): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/auth/register', data);
  return response.data;
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser(): Promise<User> {
  const response = await apiClient.get<User>('/auth/me');
  return response.data;
}

/**
 * Logout current user
 */
export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout');
  } catch {
    // Ignore errors on logout - token will be cleared locally anyway
  }
}

/** Update the signed-in user's profile. 409 when the email is taken. */
export async function updateMe(data: { name?: string; email?: string }): Promise<User> {
  const response = await apiClient.patch<User>('/auth/me', data);
  return response.data;
}

/** Change password. A wrong current password rejects without ending the session. */
export async function changePassword(data: {
  current_password: string;
  new_password: string;
}): Promise<void> {
  await apiClient.post('/auth/change-password', data);
}
