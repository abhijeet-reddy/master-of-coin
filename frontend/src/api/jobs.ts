/** Background jobs API service */

import { apiClient } from './client';
import type { BackgroundJobDetail, BackgroundJobSummary } from './types';

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

/** One job by id, with its input and result. */
export async function getJob(id: string): Promise<BackgroundJobDetail> {
  const response = await apiClient.get<BackgroundJobDetail>(`/jobs/${id}`);
  return response.data;
}
