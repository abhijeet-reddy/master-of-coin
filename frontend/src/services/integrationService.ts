/** Split provider integration API service */

import apiClient from '@/lib/axios';
import type { SplitProvider, AuthUrlResponse, SplitwiseFriend } from '@/types';

/**
 * Get Splitwise OAuth authorization URL
 * @returns Auth URL and state token for CSRF protection
 */
export async function getSplitwiseAuthUrl(): Promise<AuthUrlResponse> {
  const response = await apiClient.get<AuthUrlResponse>('/integrations/splitwise/auth-url');
  return response.data;
}

/**
 * List all configured split providers for the current user
 * @returns Array of split provider configurations (credentials excluded)
 */
export async function listProviders(): Promise<SplitProvider[]> {
  const response = await apiClient.get<SplitProvider[]>('/integrations/providers');
  return response.data;
}

/**
 * Disconnect (delete) a split provider
 * Cascades to delete all person split configs and sync records for this provider
 * @param id - Provider ID to disconnect
 */
export async function disconnectProvider(id: string): Promise<void> {
  await apiClient.delete(`/integrations/providers/${id}`);
}

/**
 * Get friends list from a specific provider
 * Currently only supports Splitwise providers
 * @param providerId - Provider ID to fetch friends from
 * @returns Array of Splitwise friends with IDs, names, and emails
 */
export async function getProviderFriends(providerId: string): Promise<SplitwiseFriend[]> {
  const response = await apiClient.get<SplitwiseFriend[]>(
    `/integrations/providers/${providerId}/friends`
  );
  return response.data;
}
