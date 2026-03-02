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

/** Request to connect a SplitPro instance */
export interface ConnectSplitProRequest {
  email: string;
}

/** Response from connecting SplitPro */
export interface ConnectSplitProResponse {
  id: string;
  provider_type: string;
  is_active: boolean;
  message: string;
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

/** Result status from the sync-split endpoint */
export type SplitSyncResultStatus = 'synced' | 'linked' | 'created' | 'mismatch';

/** User in an external expense */
export interface ExternalExpenseUser {
  external_user_id: string;
  first_name: string;
  last_name: string;
  paid_share: string;
  owed_share: string;
}

/** External expense details (returned in mismatch) */
export interface ExternalExpenseDetail {
  description: string;
  cost: string;
  currency_code: string;
  date: string;
  users: ExternalExpenseUser[];
}

/** Local split share (returned in mismatch) */
export interface LocalSplitShare {
  external_user_id: string;
  person_name: string;
  owed_share: string;
}

/** Base response from POST /transactions/:id/sync-split */
interface SplitSyncResultBase {
  status: SplitSyncResultStatus;
  message: string;
  external_expense_id?: string;
}

/** Mismatch response with full comparison data */
interface SplitSyncMismatchResult extends SplitSyncResultBase {
  status: 'mismatch';
  external_expense_id: string;
  local_total: string;
  external_total: string;
  totals_differ: boolean;
  local_splits: LocalSplitShare[];
  external_expense: ExternalExpenseDetail;
}

/** Non-mismatch response (synced, linked, created) */
interface SplitSyncOkResult extends SplitSyncResultBase {
  status: 'synced' | 'linked' | 'created';
}

/** Discriminated union for all sync results */
export type SplitSyncResult = SplitSyncMismatchResult | SplitSyncOkResult;

/** Request body for POST /transactions/:id/resolve-split-mismatch */
export interface ResolveMismatchRequest {
  external_expense_id: string;
  action: 'push' | 'pull';
}

/** Response from resolve-split-mismatch */
export interface ResolveMismatchResult {
  status: 'pushed' | 'pulled';
  message: string;
}
