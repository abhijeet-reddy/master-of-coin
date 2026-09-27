/**
 * The single HTTP client for the app.
 *
 * - Bearer token from localStorage (`auth_token`).
 * - A 401 clears the session and sends the user to `/login?from=<where they were>`.
 * - Every failure rejects with one `ApiError` shape.
 */
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiErrorBody } from './types/api';
import { clearToken, getToken, isPublicPath, loginUrlFor } from './session';

export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8080/api/v1';

export enum ApiErrorKind {
  Network = 'network',
  Timeout = 'timeout',
  Unauthorized = 'unauthorized',
  Forbidden = 'forbidden',
  NotFound = 'not_found',
  Conflict = 'conflict',
  Validation = 'validation',
  BadRequest = 'bad_request',
  Server = 'server',
  Unknown = 'unknown',
}

const DEFAULT_MESSAGES: Record<ApiErrorKind, string> = {
  [ApiErrorKind.Network]: 'Unable to reach the server. Check your connection.',
  [ApiErrorKind.Timeout]: 'The server took too long to respond. Try again.',
  [ApiErrorKind.Unauthorized]: 'Your session has ended. Sign in again.',
  [ApiErrorKind.Forbidden]: 'You do not have permission to do that.',
  [ApiErrorKind.NotFound]: 'That item was not found.',
  [ApiErrorKind.Conflict]: 'That conflicts with something that already exists.',
  [ApiErrorKind.Validation]: 'Some fields need attention.',
  [ApiErrorKind.BadRequest]: 'The request was not valid.',
  [ApiErrorKind.Server]: 'Something went wrong on the server. Try again later.',
  [ApiErrorKind.Unknown]: 'Something went wrong. Try again.',
};

function kindForStatus(status: number): ApiErrorKind {
  if (status === 401) return ApiErrorKind.Unauthorized;
  if (status === 403) return ApiErrorKind.Forbidden;
  if (status === 404) return ApiErrorKind.NotFound;
  if (status === 409) return ApiErrorKind.Conflict;
  if (status === 422) return ApiErrorKind.Validation;
  if (status === 400) return ApiErrorKind.BadRequest;
  if (status >= 500) return ApiErrorKind.Server;
  return ApiErrorKind.Unknown;
}

/** The one error shape every API call rejects with. `message` is always human-readable. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  /** Field-level messages when the server sent them (422). */
  readonly fieldErrors: Record<string, string>;

  constructor(kind: ApiErrorKind, message: string, status: number | null, fieldErrors = {}) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }

  get isNetwork(): boolean {
    return this.kind === ApiErrorKind.Network || this.kind === ApiErrorKind.Timeout;
  }
}

function fieldErrorsFrom(body: ApiErrorBody | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  const details = body?.details;
  if (details && typeof details === 'object') {
    for (const [k, v] of Object.entries(details)) {
      if (typeof v === 'string') out[k] = v;
      else if (Array.isArray(v) && typeof v[0] === 'string') out[k] = v[0];
    }
  }
  return out;
}

/** Normalise anything thrown by axios (or elsewhere) into an `ApiError`. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (axios.isAxiosError(error)) {
    const ax = error as AxiosError<ApiErrorBody | string>;
    if (!ax.response) {
      const kind = ax.code === 'ECONNABORTED' ? ApiErrorKind.Timeout : ApiErrorKind.Network;
      return new ApiError(kind, DEFAULT_MESSAGES[kind], null);
    }
    const { status, data } = ax.response;
    const kind = kindForStatus(status);
    const body = typeof data === 'object' && data !== null ? data : undefined;
    const serverMessage = body?.error || body?.message || (typeof data === 'string' ? data : '');
    const message =
      serverMessage && serverMessage.length < 300 ? serverMessage : DEFAULT_MESSAGES[kind];
    return new ApiError(kind, message, status, fieldErrorsFrom(body));
  }
  if (error instanceof Error) return new ApiError(ApiErrorKind.Unknown, error.message, null);
  return new ApiError(ApiErrorKind.Unknown, DEFAULT_MESSAGES[ApiErrorKind.Unknown], null);
}

type UnauthorizedHandler = (loginUrl: string) => void;

/** Default: hard redirect, which also resets every in-memory cache. */
let onUnauthorized: UnauthorizedHandler = (url) => window.location.assign(url);

/** Let the app swap the redirect (e.g. for tests). */
export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  onUnauthorized = handler;
}

/** Requests whose 401 means "wrong credentials", not "session ended". */
const CREDENTIAL_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/change-password'];

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const apiError = toApiError(error);
    const url = axios.isAxiosError(error) ? (error.config?.url ?? '') : '';
    const isCredentialCall = CREDENTIAL_ENDPOINTS.some((p) => url.endsWith(p));
    if (apiError.status === 401 && !isCredentialCall) {
      clearToken();
      window.dispatchEvent(new Event('moc:session-ended'));
      if (!isPublicPath(window.location.pathname)) onUnauthorized(loginUrlFor(window.location));
    }
    return Promise.reject(apiError);
  }
);

export default apiClient;
