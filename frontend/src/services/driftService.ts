/** Drift detection API service */

import apiClient from '@/lib/axios';
import type { DriftDetectionRequest, DriftDetectionJobResponse } from '@/types';

/**
 * Start a new drift detection job
 * @param request - Date range for drift detection
 * @returns Job response with job_id and initial status
 */
export async function startDriftDetection(
  request: DriftDetectionRequest
): Promise<DriftDetectionJobResponse> {
  // Convert date-only strings (YYYY-MM-DD) to ISO 8601 datetime (YYYY-MM-DDTHH:MM:SSZ)
  // The backend DriftDetectionRequest expects DateTime<Utc>, not a bare date.
  const payload = {
    ...request,
    start_date: request.start_date.includes('T')
      ? request.start_date
      : `${request.start_date}T00:00:00Z`,
    end_date: request.end_date.includes('T') ? request.end_date : `${request.end_date}T23:59:59Z`,
  };
  const response = await apiClient.post<DriftDetectionJobResponse>('/drift-detection', payload);
  return response.data;
}

/**
 * Get drift detection job status and results
 * @param jobId - Job ID to fetch
 * @returns Job response with status and optional drift report
 */
export async function getDriftJob(jobId: string): Promise<DriftDetectionJobResponse> {
  const response = await apiClient.get<DriftDetectionJobResponse>(`/drift-detection/${jobId}`);
  return response.data;
}

/**
 * Retry a failed drift detection job
 * @param jobId - Job ID to retry
 * @returns New job response with new job_id
 */
export async function retryDriftJob(jobId: string): Promise<DriftDetectionJobResponse> {
  const response = await apiClient.post<DriftDetectionJobResponse>(
    `/drift-detection/${jobId}/retry`
  );
  return response.data;
}
