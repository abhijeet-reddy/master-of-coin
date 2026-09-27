// Schedule types

import type { BackgroundJobSummary } from './jobs';

/** A scheduled job configuration */
export interface Schedule {
  id: string;
  name: string;
  job_type: string;
  cron_expr: string;
  cron_description: string;
  parameters?: Record<string, unknown>;
  is_active: boolean;
  next_run_at?: string;
  last_run_at?: string;
  created_at: string;
  updated_at: string;
}

/** Request to create a new schedule */
export interface CreateScheduleRequest {
  name: string;
  job_type: string;
  cron_expr: string;
  parameters?: Record<string, unknown>;
}

/** Request to update an existing schedule */
export interface UpdateScheduleRequest {
  name?: string;
  cron_expr?: string;
  parameters?: Record<string, unknown>;
  is_active?: boolean;
}

/** Response from GET /schedules/:id with related data */
export interface ScheduleDetailResponse {
  schedule: Schedule;
  recent_jobs: BackgroundJobSummary[];
  upcoming_runs: string[];
}
