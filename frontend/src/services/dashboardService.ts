import apiClient from '@/lib/axios';
import type { DashboardSummary, ApiResponse } from '@/types';

/**
 * Get dashboard summary with all key metrics
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const response = await apiClient.get<ApiResponse<DashboardSummary>>('/dashboard');
  return response.data.data;
}
