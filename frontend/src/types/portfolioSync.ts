// Portfolio sync types matching backend DTOs

import type { InvestmentProviderType } from './investmentProvider';

/** Request to trigger a portfolio sync (POST /portfolio-sync) */
export interface PortfolioSyncRequest {
  account_id?: string;
}

/** Response from starting a portfolio sync job */
export interface StartPortfolioSyncResponse {
  job_id: string;
  status: string;
  message: string;
}

/** Response from getting a portfolio sync job status */
export interface PortfolioSyncJobResponse {
  job_id: string;
  status: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  result?: PortfolioSyncReport;
  error?: string;
}

/** Full sync report stored in job result */
export interface PortfolioSyncReport {
  synced_accounts: AccountSyncResult[];
  total_synced: number;
  total_failed: number;
}

/** Result for a single account sync */
export interface AccountSyncResult {
  account_id: string;
  account_name: string;
  provider_type: InvestmentProviderType;
  previous_balance: string;
  new_value: string;
  adjustment_amount: string;
  adjustment_transaction_id?: string;
  /** "synced", "no_change", "failed" */
  status: string;
  error?: string;
}
