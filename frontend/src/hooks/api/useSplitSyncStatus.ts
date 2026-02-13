import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSyncStatus, retrySync } from '@/services/splitSyncService';

/**
 * Fetch sync status for a transaction split
 * Only fetches when a valid splitId is provided
 *
 * @param splitId - Transaction split ID to fetch sync status for
 * @returns React Query result with sync status records array
 */
export function useSplitSyncStatus(splitId: string) {
  return useQuery({
    queryKey: ['splits', splitId, 'sync-status'],
    queryFn: () => getSyncStatus(splitId),
    enabled: !!splitId,
  });
}

/**
 * Retry a failed sync for a specific sync record
 * Invalidates split sync status queries on success
 *
 * @returns React Query mutation for retrying failed syncs
 */
export function useRetrySync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (syncRecordId: string) => retrySync(syncRecordId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['splits'] });
    },
  });
}
