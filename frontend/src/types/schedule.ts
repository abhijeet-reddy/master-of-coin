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

/** Cron preset option for the simple frequency selector */
export interface CronPreset {
  label: string;
  value: string;
  description: string;
}

/** Available cron presets for the simple mode selector */
export const CRON_PRESETS: readonly CronPreset[] = [
  { label: 'Hourly', value: '0 * * * *', description: 'At the start of each hour' },
  { label: 'Daily', value: '0 0 * * *', description: 'At 00:00 (12:00 AM)' },
  { label: 'Weekly', value: '0 0 * * 1', description: 'Every Sunday at 00:00' },
  { label: 'Monthly', value: '0 0 1 * *', description: 'On the 1st at 00:00' },
] as const;
