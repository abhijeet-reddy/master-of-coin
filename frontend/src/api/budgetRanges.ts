import { apiClient } from './client';
import type { BudgetRange, BudgetRangeRequest } from './types';

/** Range history for one budget, newest first. */
export async function getBudgetRanges(budgetId: string): Promise<BudgetRange[]> {
  const response = await apiClient.get<BudgetRange[]>(`/budgets/${budgetId}/ranges`);
  return response.data;
}

/** Add a range. 409 when it overlaps another range of the budget. */
export async function addBudgetRange(
  budgetId: string,
  data: BudgetRangeRequest
): Promise<BudgetRange> {
  const response = await apiClient.post<BudgetRange>(`/budgets/${budgetId}/ranges`, data);
  return response.data;
}

/** Replace a range. 409 when it would overlap another. */
export async function updateBudgetRange(
  budgetId: string,
  rangeId: string,
  data: BudgetRangeRequest
): Promise<BudgetRange> {
  const response = await apiClient.put<BudgetRange>(`/budgets/${budgetId}/ranges/${rangeId}`, data);
  return response.data;
}

/** Remove a range. 422 for the budget's only range. */
export async function deleteBudgetRange(budgetId: string, rangeId: string): Promise<void> {
  await apiClient.delete(`/budgets/${budgetId}/ranges/${rangeId}`);
}
