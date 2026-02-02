// API Key types

export type ApiKeyStatus = 'active' | 'revoked' | 'expired';

export type ScopePermission = 'read' | 'write';

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
  expires_at?: string;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateApiKeyResponse extends ApiKey {
  key: string;
}

export interface CreateApiKeyRequest {
  name: string;
  scopes: ApiKeyScopes;
  expires_in_days?: number | null;
}

export interface UpdateApiKeyRequest {
  name?: string;
  expires_in_days?: number | null;
  scopes?: ApiKeyScopes;
}

export interface ListApiKeysResponse {
  api_keys: ApiKey[];
}
