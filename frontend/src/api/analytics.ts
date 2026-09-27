import { apiClient } from './client';
import type { MonthlyTotals, NetWorthPoint, SpendingTrendDay } from './types/analytics';

export async function getMonthlyTotals(months = 12): Promise<MonthlyTotals[]> {
  const response = await apiClient.get<MonthlyTotals[]>('/analytics/monthly', {
    params: { months },
  });
  return response.data;
}

export enum HistoryInterval {
  Month = 'month',
  Week = 'week',
}

/** Omitted bounds default server side: `to` = today, `from` = 12 months before `to`. */
export async function getNetWorthHistory(
  params: { from?: string; to?: string; interval?: HistoryInterval } = {}
): Promise<NetWorthPoint[]> {
  const response = await apiClient.get<NetWorthPoint[]>('/analytics/net-worth-history', { params });
  return response.data;
}

export async function getSpendingTrend(params: {
  from: string;
  to: string;
}): Promise<SpendingTrendDay[]> {
  const response = await apiClient.get<SpendingTrendDay[]>('/analytics/spending-trend', { params });
  return response.data;
}
