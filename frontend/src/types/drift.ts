// Drift detection types

import type { JobStatus } from './jobs';
import type { SplitProviderType } from './splitIntegration';

/** Request to start a drift detection job */
export interface DriftDetectionRequest {
  start_date: string;
  end_date: string;
}

/** Response from GET /drift-detection/:job_id */
export interface DriftDetectionJobResponse {
  job_id: string;
  status: JobStatus;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  result?: DriftReport;
  error?: string;
}

/** Full drift report returned when job completes */
export interface DriftReport {
  summary: DriftSummary;
  drifted: DriftedItem[];
  missing_on_external: MissingOnExternal[];
  missing_on_local: MissingOnLocal[];
}

/** Aggregate counts from drift detection */
export interface DriftSummary {
  total_local: number;
  total_external: number;
  synced: number;
  drifted: number;
  missing_on_external: number;
  missing_on_local: number;
}

/** A transaction that exists on both sides but with different data */
export interface DriftedItem {
  transaction_id: string;
  transaction_title: string;
  transaction_date: string;
  local_amount: string;
  external_expense_id: string;
  external_description: string;
  external_cost: string;
  external_date: string;
  local_splits: LocalSplitInfo[];
  external_splits: ExternalSplitInfo[];
  /** Provider that owns the external expense (e.g. "splitwise", "splitpro") */
  provider_type?: SplitProviderType;
}

/** A local transaction missing on the external provider */
export interface MissingOnExternal {
  transaction_id: string;
  transaction_title: string;
  transaction_date: string;
  amount: string;
  splits: LocalSplitInfo[];
}

/** An external expense missing in local data */
export interface MissingOnLocal {
  external_expense_id: string;
  description: string;
  cost: string;
  currency_code: string;
  date: string;
  users: ExternalSplitInfo[];
  unmapped_users?: UnmappedUser[];
  /** Provider that owns the external expense (e.g. "splitwise", "splitpro") */
  provider_type?: SplitProviderType;
}

/** Local split share info */
export interface LocalSplitInfo {
  person_name: string;
  external_user_id: string;
  owed_share: string;
}

/** External split share info */
export interface ExternalSplitInfo {
  external_user_id: string;
  first_name: string;
  last_name: string;
  owed_share: string;
  paid_share: string;
}

/** An external user that has no local person mapping */
export interface UnmappedUser {
  external_user_id: string;
  first_name: string;
  last_name: string;
}
