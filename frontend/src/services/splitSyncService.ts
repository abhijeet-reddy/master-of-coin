/** Split sync status API service */

import apiClient from '@/lib/axios';
import type { SplitSyncStatus } from '@/types';

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
