/** Investment provider and portfolio sync API service */

import apiClient from '@/lib/axios';
import type {
  InvestmentProvider,
  ConnectInvestmentProviderRequest,
} from '@/types/investmentProvider';
import type {
  PortfolioSyncRequest,
  StartPortfolioSyncResponse,
  PortfolioSyncJobResponse,
} from '@/types/portfolioSync';

// --- Investment Provider endpoints ---

/**
 * Connect a brokerage provider to an investment account
 * @param request - Provider credentials and account ID
 * @returns Created investment provider record
 */
export async function connectProvider(
  request: ConnectInvestmentProviderRequest
): Promise<InvestmentProvider> {
  const response = await apiClient.post<InvestmentProvider>('/investment-providers', request);
  return response.data;
}

/**
 * List all connected investment providers for the current user
 * @returns Array of investment provider records (no credentials)
 */
export async function listProviders(): Promise<InvestmentProvider[]> {
  const response = await apiClient.get<InvestmentProvider[]>('/investment-providers');
  return response.data;
}

/**
 * Disconnect (delete) an investment provider
 * @param id - Provider ID to disconnect
 */
export async function disconnectProvider(id: string): Promise<void> {
  await apiClient.delete(`/investment-providers/${id}`);
}

// --- Portfolio Sync endpoints ---

/**
 * Start a new portfolio sync job
 * @param request - Optional account_id filter
 * @returns Job response with job_id and initial status
 */
export async function startPortfolioSync(
  request: PortfolioSyncRequest
): Promise<StartPortfolioSyncResponse> {
  const response = await apiClient.post<StartPortfolioSyncResponse>('/portfolio-sync', request);
  return response.data;
}

/**
 * Get portfolio sync job status and results
 * @param jobId - Job ID to fetch
 * @returns Job response with status and optional sync report
 */
export async function getPortfolioSyncJob(jobId: string): Promise<PortfolioSyncJobResponse> {
  const response = await apiClient.get<PortfolioSyncJobResponse>(`/portfolio-sync/${jobId}`);
  return response.data;
}

/**
 * Retry a failed portfolio sync job
 * @param jobId - Job ID to retry
 * @returns New job response with new job_id
 */
export async function retryPortfolioSync(jobId: string): Promise<StartPortfolioSyncResponse> {
  const response = await apiClient.post<StartPortfolioSyncResponse>(
    `/portfolio-sync/${jobId}/retry`
  );
  return response.data;
}
