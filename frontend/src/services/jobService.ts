/** Background jobs API service */

import apiClient from '@/lib/axios';
import type { BackgroundJobSummary } from '@/types';

export interface ListJobsParams {
  job_type?: string;
  limit?: number;
  offset?: number;
}

/**
 * List background jobs for the current user
 * @param params - Optional filters: job_type, limit, offset
 * @returns Array of job summaries
 */
export async function listJobs(params?: ListJobsParams): Promise<BackgroundJobSummary[]> {
  const response = await apiClient.get<BackgroundJobSummary[]>('/jobs', { params });
  return response.data;
}
