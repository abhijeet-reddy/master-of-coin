import { useSplitSyncStatus, useRetrySync } from '@/hooks/api/useSplitSyncStatus';
import { toaster } from '@/components/ui/toaster';

/**
 * Manages sync status display and retry logic for a transaction split.
 * Extracts all business logic from the SplitSyncStatus component.
 *
 * @param splitId - Transaction split ID to fetch sync status for
 * @returns Sync status data, loading states, and retry handler
 */
export default function useSplitSyncBadge(splitId: string) {
  const { data: syncRecords = [], isLoading } = useSplitSyncStatus(splitId);
  const retryMutation = useRetrySync();

  // Get the first (primary) sync record if any
  const primarySync = syncRecords.length > 0 ? syncRecords[0] : null;

  const handleRetry = () => {
    if (!primarySync) return;

    retryMutation.mutate(primarySync.id, {
      onSuccess: () => {
        toaster.create({
          title: 'Sync Retry Initiated',
          description: 'The sync will be retried shortly.',
          type: 'success',
        });
      },
      onError: () => {
        toaster.create({
          title: 'Retry Failed',
          description: 'Could not retry sync. Please try again later.',
          type: 'error',
        });
      },
    });
  };

  return {
    primarySync,
    syncRecords,
    isLoading,
    isRetrying: retryMutation.isPending,
    handleRetry,
  };
}
