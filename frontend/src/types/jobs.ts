// Background job types

/** Supported background job types */
export enum JobType {
  DRIFT_DETECTION = 'DRIFT_DETECTION',
  BULK_SYNC = 'BULK_SYNC',
  PORTFOLIO_SYNC = 'PORTFOLIO_SYNC',
  BANK_SYNC = 'BANK_SYNC',
}

/** Background job status values */
export enum JobStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/** Summary view of a background job (used in job list) */
export interface BackgroundJobSummary {
  id: string;
  job_type: JobType;
  status: JobStatus;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
  summary?: Record<string, unknown>;
}
