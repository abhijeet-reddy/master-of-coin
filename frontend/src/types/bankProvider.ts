// Bank provider types matching backend DTOs

/** Supported bank provider types */
export enum BankProviderType {
  TRUELAYER = 'TRUELAYER',
}

/** Bank provider record (from GET /bank-providers) */
export interface BankProvider {
  id: string;
  user_id: string;
  account_id: string;
  provider_type: BankProviderType;
  external_account_id: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Response for GET /bank-providers/truelayer/auth-url */
export interface BankAuthUrlResponse {
  auth_url: string;
  state: string;
}

/** Request for POST /bank-providers/:id/sync */
export interface BankSyncRequest {
  from_date?: string;
  to_date?: string;
}

/** Response for POST /bank-providers/:id/sync (202 Accepted) */
export interface StartBankSyncResponse {
  job_id: string;
  status: string;
  message: string;
}

/** A single transaction fetched from the bank provider */
export interface FetchedBankTransaction {
  external_id: string;
  description: string;
  amount: string;
  currency: string;
  date: string;
  transaction_type: string;
  merchant_name: string | null;
  category: string | null;
  already_imported: boolean;
}

/** Balance information from the bank provider */
export interface BankBalanceInfo {
  current: string;
  available: string | null;
  currency: string;
  updated_at: string;
}

/** Summary counts for the sync report */
export interface BankSyncSummary {
  total_fetched: number;
  already_imported: number;
  new_transactions: number;
}

/** The full bank sync report stored in job result */
export interface BankSyncReport {
  provider_type: BankProviderType;
  account_name: string;
  bank_provider_id: string;
  /** The local account ID linked to this bank provider */
  account_id: string;
  balance: BankBalanceInfo | null;
  transactions: FetchedBankTransaction[];
  summary: BankSyncSummary;
}

/** Response for GET /bank-providers/sync/:job_id */
export interface BankSyncJobResponse {
  job_id: string;
  status: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  result?: BankSyncReport;
  error?: string;
}

/** Request for POST /bank-providers/sync/:job_id/import */
export interface BankSyncImportRequest {
  transaction_ids: string[];
}

/** Response for POST /bank-providers/sync/:job_id/import */
export interface BankImportResult {
  imported_count: number;
  skipped_count: number;
  errors: string[];
}

/** Response for GET /bank-providers/:id/balance */
export interface BankBalanceResponse {
  current: string;
  available: string | null;
  currency: string;
  updated_at: string;
}

/** External bank account from provider (for linking) */
export interface ExternalBankAccount {
  account_id: string;
  account_name: string;
  account_type: string;
  currency: string;
  account_number: string | null;
  sort_code: string | null;
}

/** Request for PUT /bank-providers/:id/link-account */
export interface LinkExternalAccountRequest {
  external_account_id: string;
}
