import { useState } from 'react';
import {
  useStartPortfolioSync,
  usePortfolioSyncJob,
  useRetryPortfolioSync,
} from '@/hooks/api/usePortfolioSync';
import { toaster } from '@/components/ui/toaster';
import { JobStatus } from '@/types';

/**
 * Manages portfolio sync job lifecycle for a specific account.
 * Handles triggering sync, polling for status, and retrying failed jobs.
 *
 * @param accountId - The investment account ID
 * @returns Sync state and action handlers
 */
export default function usePortfolioSyncTrigger(accountId: string) {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const startMutation = useStartPortfolioSync();
  const retryMutation = useRetryPortfolioSync();
  const { data: syncJob } = usePortfolioSyncJob(activeJobId);

  const isSyncing =
    startMutation.isPending ||
    syncJob?.status === JobStatus.PENDING ||
    syncJob?.status === JobStatus.RUNNING;

  const handleSync = () => {
    startMutation.mutate(
      { account_id: accountId },
      {
        onSuccess: (response) => {
          setActiveJobId(response.job_id);
          toaster.create({
            title: 'Portfolio Sync Started',
            description: 'Fetching latest portfolio value from Trading 212...',
            type: 'info',
          });
        },
        onError: (error) => {
          const message =
            error instanceof Error ? error.message : 'Could not start portfolio sync.';
          toaster.create({
            title: 'Sync Failed',
            description: message,
            type: 'error',
          });
        },
      }
    );
  };

  const handleRetry = () => {
    if (!activeJobId) return;
    retryMutation.mutate(activeJobId, {
      onSuccess: (response) => {
        setActiveJobId(response.job_id);
        toaster.create({
          title: 'Retrying Portfolio Sync',
          description: 'Retrying portfolio sync...',
          type: 'info',
        });
      },
      onError: () => {
        toaster.create({
          title: 'Retry Failed',
          description: 'Could not retry the sync job.',
          type: 'error',
        });
      },
    });
  };

  return {
    syncJob,
    isSyncing,
    handleSync,
    handleRetry,
  };
}
