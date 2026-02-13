// Split provider integration types

/** Supported split provider types */
export type SplitProviderType = 'splitwise' | 'splitpro';

/** Split provider configuration from the backend */
export interface SplitProvider {
  id: string;
  user_id: string;
  provider_type: SplitProviderType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Response from GET /integrations/splitwise/auth-url */
export interface AuthUrlResponse {
  auth_url: string;
  state: string;
}

/** Splitwise friend from the Splitwise API */
export interface SplitwiseFriend {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  full_name: string;
}

/** Person split config linking a person to an external provider user */
export interface PersonSplitConfig {
  id: string;
  person_id: string;
  split_provider_id: string;
  provider_type: string;
  external_user_id: string;
  created_at: string;
  updated_at: string;
}

/** Request to set a person's split provider configuration */
export interface SetPersonSplitConfigRequest {
  split_provider_id: string;
  external_user_id: string;
}

/** Sync status values matching backend SyncStatus enum */
export type SyncStatusType = 'pending' | 'synced' | 'failed' | 'deleted';

/** Sync status for a transaction split */
export interface SplitSyncStatus {
  id: string;
  transaction_split_id: string;
  split_provider_id: string;
  provider_type: string;
  external_expense_id?: string;
  sync_status: SyncStatusType;
  last_sync_at?: string;
  last_error?: string;
  retry_count: number;
  external_url?: string;
}
