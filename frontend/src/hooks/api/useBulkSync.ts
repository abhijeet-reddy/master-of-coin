import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { startBulkSync, getBulkSyncJob, retryBulkSync } from '@/services/bulkSyncService';
import type { BulkSyncRequest } from '@/types';
import { JobStatus } from '@/types';

/**
 * Start a new bulk sync job
 * Invalidates jobs list on success
 *
 * @returns React Query mutation for starting bulk sync
 */
export function useStartBulkSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: BulkSyncRequest) => startBulkSync(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

/**
 * Fetch and poll a bulk sync job
 * Polls every 2s while PENDING or RUNNING, stops when COMPLETED or FAILED
 *
 * @param jobId - Job ID to poll, or null to disable
 * @returns React Query result with bulk sync job response
 */
export function useBulkSyncJob(jobId: string | null) {
  return useQuery({
    queryKey: ['sync', jobId],
    queryFn: () => getBulkSyncJob(jobId!),
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
 * Retry a failed bulk sync job
 * Invalidates jobs list and sync queries on success
 *
 * @returns React Query mutation for retrying bulk sync
 */
export function useRetryBulkSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobId: string) => retryBulkSync(jobId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
      void queryClient.invalidateQueries({ queryKey: ['sync'] });
    },
  });
}
