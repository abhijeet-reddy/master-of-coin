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
  /** Schedule that started the job; null for jobs started by hand. */
  schedule_id?: string | null;
}

/** `GET /jobs/:id`: the summary fields plus the full input and result. */
export interface BackgroundJobDetail extends BackgroundJobSummary {
  previous_job_id?: string | null;
  input?: Record<string, unknown> | null;
  result?: Record<string, unknown> | null;
}
