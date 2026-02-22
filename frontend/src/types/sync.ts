// Bulk sync types

import type { JobStatus } from './jobs';

/** Direction of a sync action */
export enum SyncAction {
  PUSH = 'push',
  PULL = 'pull',
}

/** Selection state for a drifted item: action + the provider's external ID */
export interface DriftedSelection {
  action: SyncAction;
  externalExpenseId: string;
}

/** A single item to sync */
export interface SyncItem {
  action: SyncAction;
  transaction_id?: string;
  external_expense_id?: string;
}

/** Request body for POST /sync */
export interface BulkSyncRequest {
  items: SyncItem[];
}

/** Response from POST /sync (job created) */
export interface StartSyncJobResponse {
  job_id: string;
  status: JobStatus;
  message: string;
  total_items: number;
}

/** Response from GET /sync/:job_id */
export interface BulkSyncJobResponse {
  job_id: string;
  status: JobStatus;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  result?: BulkSyncReport;
  error?: string;
}

/** Full bulk sync report returned when job completes */
export interface BulkSyncReport {
  summary: BulkSyncSummary;
  items: SyncItemResult[];
}

/** Aggregate counts from bulk sync */
export interface BulkSyncSummary {
  total: number;
  succeeded: number;
  failed: number;
}

/** Result for a single sync item */
export interface SyncItemResult {
  action: SyncAction;
  transaction_id?: string;
  external_expense_id?: string;
  status: string;
  detail?: Record<string, unknown>;
  error?: string;
}
