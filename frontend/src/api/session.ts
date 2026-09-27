/** Session token storage. The JWT lives in localStorage under `auth_token`. */

export const TOKEN_KEY = 'auth_token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage unavailable: nothing to clear
  }
}

const PUBLIC_PATHS = ['/login', '/register'];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Build `/login?from=<current path>` so login can send the user back. */
export function loginUrlFor(location: { pathname: string; search: string; hash?: string }): string {
  if (isPublicPath(location.pathname)) return '/login';
  const from = `${location.pathname}${location.search}${location.hash ?? ''}`;
  return from && from !== '/' ? `/login?from=${encodeURIComponent(from)}` : '/login';
}

/**
 * Sanitise a `from` value so login can only return to a same-origin path
 * (never `//evil.example` or `https://...`).
 */
export function safeReturnPath(from: string | null | undefined, fallback = '/dashboard'): string {
  if (!from || !from.startsWith('/') || from.startsWith('//') || isPublicPath(from))
    return fallback;
  return from;
}
