import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
 * Invalidates account and transaction queries when sync completes.
 *
 * @param accountId - The investment account ID
 * @returns Sync state and action handlers
 */
export default function usePortfolioSyncTrigger(accountId: string) {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const prevStatusRef = useRef<string | undefined>(undefined);

  const startMutation = useStartPortfolioSync();
  const retryMutation = useRetryPortfolioSync();
  const { data: syncJob } = usePortfolioSyncJob(activeJobId);

  const isSyncing =
    startMutation.isPending ||
    syncJob?.status === JobStatus.PENDING ||
    syncJob?.status === JobStatus.RUNNING;

  // Invalidate relevant queries when sync job completes
  useEffect(() => {
    const currentStatus = syncJob?.status;
    const prevStatus = prevStatusRef.current;

    // Only invalidate when status transitions TO COMPLETED (not on initial load)
    if (
      currentStatus === JobStatus.COMPLETED &&
      prevStatus !== undefined &&
      prevStatus !== (JobStatus.COMPLETED as string)
    ) {
      // Specific account balance
      void queryClient.invalidateQueries({ queryKey: ['accounts', accountId] });
      // Account's transactions (new adjustment transaction)
      void queryClient.invalidateQueries({ queryKey: ['transactions', { account_id: accountId }] });
      // Dashboard balance totals
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });

      toaster.create({
        title: 'Portfolio Sync Complete',
        description: 'Account balance and transactions have been updated.',
        type: 'success',
      });
    }

    prevStatusRef.current = currentStatus;
  }, [syncJob?.status, accountId, queryClient]);

  const handleSync = () => {
    startMutation.mutate(
      { account_id: accountId },
      {
        onSuccess: (response) => {
          setActiveJobId(response.job_id);
          toaster.create({
            title: 'Portfolio Sync Started',
            description: 'Fetching latest portfolio value from your brokerage...',
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
