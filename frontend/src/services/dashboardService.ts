import apiClient from '@/lib/axios';
import type { DashboardSummary } from '@/types';

/**
 * Get dashboard summary with all key metrics
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const response = await apiClient.get<DashboardSummary>('/dashboard');
  return response.data;
}
