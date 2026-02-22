import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { startDriftDetection, getDriftJob, retryDriftJob } from '@/services/driftService';
import type { DriftDetectionRequest } from '@/types';
import { JobStatus } from '@/types';

/**
 * Start a new drift detection job
 * Invalidates jobs list on success
 *
 * @returns React Query mutation for starting drift detection
 */
export function useStartDriftDetection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: DriftDetectionRequest) => startDriftDetection(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

/**
 * Fetch and poll a drift detection job
 * Polls every 2s while PENDING or RUNNING, stops when COMPLETED or FAILED
 *
 * @param jobId - Job ID to poll, or null to disable
 * @returns React Query result with drift detection job response
 */
export function useDriftJob(jobId: string | null) {
  return useQuery({
    queryKey: ['drift-detection', jobId],
    queryFn: () => getDriftJob(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === JobStatus.PENDING || status === JobStatus.RUNNING) {
        return 2000;
      }
      return false;
    },
  });
}

/**
 * Retry a failed drift detection job
 * Invalidates jobs list and drift detection queries on success
 *
 * @returns React Query mutation for retrying drift detection
 */
export function useRetryDriftJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobId: string) => retryDriftJob(jobId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
      void queryClient.invalidateQueries({ queryKey: ['drift-detection'] });
    },
  });
}
