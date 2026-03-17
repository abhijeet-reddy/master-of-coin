/** Bank provider API service */

import apiClient from '@/lib/axios';
import type {
  BankProvider,
  BankAuthUrlResponse,
  BankSyncRequest,
  StartBankSyncResponse,
  BankSyncJobResponse,
  BankBalanceResponse,
  ExternalBankAccount,
  LinkExternalAccountRequest,
} from '@/types/bankProvider';

/**
 * List all bank provider connections for the current user
 * @returns Array of bank provider records (no credentials)
 */
export async function listBankProviders(): Promise<BankProvider[]> {
  const response = await apiClient.get<BankProvider[]>('/bank-providers');
  return response.data;
}

/**
 * Get TrueLayer OAuth authorization URL
 * @param accountId - The account to connect the bank to
 * @returns Auth URL and state token for CSRF protection
 */
export async function getAuthUrl(accountId: string): Promise<BankAuthUrlResponse> {
  const response = await apiClient.get<BankAuthUrlResponse>('/bank-providers/truelayer/auth-url', {
    params: { account_id: accountId },
  });
  return response.data;
}

/**
 * Disconnect (delete) a bank provider
 * @param id - Provider ID to disconnect
 */
export async function disconnectProvider(id: string): Promise<void> {
  await apiClient.delete(`/bank-providers/${id}`);
}

/**
 * Start a bank sync job to fetch transactions from the provider
 * @param id - Bank provider ID
 * @param request - Optional date range
 * @returns Job response with job_id and initial status
 */
export async function startSync(
  id: string,
  request: BankSyncRequest = {}
): Promise<StartBankSyncResponse> {
  const response = await apiClient.post<StartBankSyncResponse>(
    `/bank-providers/${id}/sync`,
    request
  );
  return response.data;
}

/**
 * Get bank sync job status and results
 * @param jobId - Job ID to fetch
 * @returns Job response with status and optional sync report
 */
export async function getSyncJob(jobId: string): Promise<BankSyncJobResponse> {
  const response = await apiClient.get<BankSyncJobResponse>(`/bank-providers/sync/${jobId}`);
  return response.data;
}

/**
 * Fetch current balance from the bank provider
 * @param id - Bank provider ID
 * @returns Current and available balance
 */
export async function getBalance(id: string): Promise<BankBalanceResponse> {
  const response = await apiClient.get<BankBalanceResponse>(`/bank-providers/${id}/balance`);
  return response.data;
}

/**
 * List external bank accounts from the provider (for linking after OAuth)
 * @param id - Bank provider ID
 * @returns Array of external bank accounts
 */
export async function listExternalAccounts(id: string): Promise<ExternalBankAccount[]> {
  const response = await apiClient.get<ExternalBankAccount[]>(`/bank-providers/${id}/accounts`);
  return response.data;
}

/**
 * Link a specific external bank account to this provider
 * @param id - Bank provider ID
 * @param externalAccountId - The external account ID to link
 * @returns Updated bank provider record
 */
export async function linkExternalAccount(
  id: string,
  externalAccountId: string
): Promise<BankProvider> {
  const request: LinkExternalAccountRequest = { external_account_id: externalAccountId };
  const response = await apiClient.put<BankProvider>(`/bank-providers/${id}/link-account`, request);
  return response.data;
}
