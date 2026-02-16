/** Split sync status API service */

import apiClient from '@/lib/axios';
import type {
  SplitSyncStatus,
  SplitSyncResult,
  ResolveMismatchRequest,
  ResolveMismatchResult,
} from '@/types';

/**
 * Get sync status for a transaction split
 * Returns all sync records for the given split (one per provider)
 * @param splitId - Transaction split ID
 * @returns Array of sync status records
 */
export async function getSyncStatus(splitId: string): Promise<SplitSyncStatus[]> {
  const response = await apiClient.get<SplitSyncStatus[]>(`/splits/${splitId}/sync-status`);
  return response.data;
}

/**
 * Retry a failed sync for a specific sync record
 * @param syncRecordId - Sync record ID to retry
 * @returns Updated sync status after retry attempt
 */
export async function retrySync(syncRecordId: string): Promise<SplitSyncStatus> {
  const response = await apiClient.post<SplitSyncStatus>(`/splits/${syncRecordId}/retry-sync`);
  return response.data;
}

/**
 * Sync a transaction's splits with the external split provider.
 * Single entry point: finds matching expenses, links or creates as needed.
 * @param transactionId - Transaction ID to sync
 * @returns Sync result with status (linked/created/mismatch)
 */
export async function syncTransactionSplit(transactionId: string): Promise<SplitSyncResult> {
  const response = await apiClient.post<SplitSyncResult>(
    `/transactions/${transactionId}/sync-split`
  );
  return response.data;
}

/**
 * Resolve a split mismatch by pushing local data or pulling external data.
 * @param transactionId - Transaction ID
 * @param request - Action (push/pull) and external expense ID
 * @returns Resolution result
 */
export async function resolveSplitMismatch(
  transactionId: string,
  request: ResolveMismatchRequest
): Promise<ResolveMismatchResult> {
  const response = await apiClient.post<ResolveMismatchResult>(
    `/transactions/${transactionId}/resolve-split-mismatch`,
    request
  );
  return response.data;
}
