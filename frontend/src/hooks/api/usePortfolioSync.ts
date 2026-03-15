import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  startPortfolioSync,
  getPortfolioSyncJob,
  retryPortfolioSync,
} from '@/services/investmentProviderService';
import type { PortfolioSyncRequest } from '@/types';
import { JobStatus } from '@/types';

/**
 * Start a new portfolio sync job
 * Invalidates jobs list on success
 */
export function useStartPortfolioSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: PortfolioSyncRequest) => startPortfolioSync(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

/**
 * Fetch and poll a portfolio sync job
 * Polls every 2s while PENDING or RUNNING, stops when COMPLETED or FAILED
 *
 * @param jobId - Job ID to poll, or null to disable
 */
export function usePortfolioSyncJob(jobId: string | null) {
  return useQuery({
    queryKey: ['portfolio-sync', jobId],
    queryFn: () => getPortfolioSyncJob(jobId!),
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
 * Retry a failed portfolio sync job
 * Invalidates jobs list and portfolio-sync queries on success
 */
export function useRetryPortfolioSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobId: string) => retryPortfolioSync(jobId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
      void queryClient.invalidateQueries({ queryKey: ['portfolio-sync'] });
    },
  });
}
