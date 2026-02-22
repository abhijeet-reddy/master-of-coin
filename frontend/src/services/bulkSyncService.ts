/** Bulk sync API service */

import apiClient from '@/lib/axios';
import type { BulkSyncRequest, StartSyncJobResponse, BulkSyncJobResponse } from '@/types';

/**
 * Start a new bulk sync job
 * @param request - Items to sync (push/pull)
 * @returns Job response with job_id and initial status
 */
export async function startBulkSync(request: BulkSyncRequest): Promise<StartSyncJobResponse> {
  const response = await apiClient.post<StartSyncJobResponse>('/sync', request);
  return response.data;
}

/**
 * Get bulk sync job status and results
 * @param jobId - Job ID to fetch
 * @returns Job response with status and optional sync report
 */
export async function getBulkSyncJob(jobId: string): Promise<BulkSyncJobResponse> {
  const response = await apiClient.get<BulkSyncJobResponse>(`/sync/${jobId}`);
  return response.data;
}

/**
 * Retry a failed bulk sync job
 * @param jobId - Job ID to retry
 * @returns New job response with new job_id
 */
export async function retryBulkSync(jobId: string): Promise<BulkSyncJobResponse> {
  const response = await apiClient.post<BulkSyncJobResponse>(`/sync/${jobId}/retry`);
  return response.data;
}
