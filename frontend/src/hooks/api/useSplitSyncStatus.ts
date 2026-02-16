import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSyncStatus,
  retrySync,
  syncTransactionSplit,
  resolveSplitMismatch,
} from '@/services/splitSyncService';
import type { ResolveMismatchRequest } from '@/types';

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

/**
 * Sync a transaction's splits with the external split provider.
 * Invalidates split sync status and transaction queries on success.
 *
 * @returns React Query mutation for syncing transaction splits
 */
export function useSyncTransactionSplit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId: string) => syncTransactionSplit(transactionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['splits'] });
      void queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

/**
 * Resolve a split mismatch (push local or pull external).
 * Invalidates split sync status and transaction queries on success.
 *
 * @returns React Query mutation for resolving split mismatches
 */
export function useResolveSplitMismatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      transactionId,
      request,
    }: {
      transactionId: string;
      request: ResolveMismatchRequest;
    }) => resolveSplitMismatch(transactionId, request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['splits'] });
      void queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
