// API keys (/api-keys). Mirrors backend/src/models/api_key.rs.

export enum ApiKeyStatus {
  Active = 'active',
  Revoked = 'revoked',
  Expired = 'expired',
}

export enum ScopePermission {
  Read = 'read',
  Write = 'write',
}

export interface ApiKeyScopes {
  transactions: ScopePermission[];
  accounts: ScopePermission[];
  budgets: ScopePermission[];
  categories: ScopePermission[];
  people: ScopePermission[];
}

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: ApiKeyScopes;
  status: ApiKeyStatus;
  expires_at?: string | null;
  last_used_at?: string | null;
  created_at: string;
  updated_at: string;
}

/** The only response that carries the plain key; it is never shown again. */
export interface CreateApiKeyResponse extends ApiKey {
  key: string;
}

export interface CreateApiKeyRequest {
  name: string;
  scopes: ApiKeyScopes;
  /** Null for a key that never expires. */
  expires_in_days: number | null;
}

/** Every field optional. An absent `expires_in_days` keeps the current expiry. */
export interface UpdateApiKeyRequest {
  name?: string;
  expires_in_days?: number;
  scopes?: ApiKeyScopes;
}

export interface ListApiKeysResponse {
  api_keys: ApiKey[];
}
