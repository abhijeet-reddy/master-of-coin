import { apiClient } from './client';
import type { Budget, CreateBudgetRequest, UpdateBudgetRequest } from './types';

/** Every budget of the user, with the current period's spending. */
export async function getBudgets(): Promise<Budget[]> {
  const response = await apiClient.get<Budget[]>('/budgets');
  return response.data;
}

export async function getBudget(id: string): Promise<Budget> {
  const response = await apiClient.get<Budget>(`/budgets/${id}`);
  return response.data;
}

/** Creates the budget only; add its first range with `addBudgetRange`. */
export async function createBudget(data: CreateBudgetRequest): Promise<Budget> {
  const response = await apiClient.post<Budget>('/budgets', data);
  return response.data;
}

export async function updateBudget(id: string, data: UpdateBudgetRequest): Promise<Budget> {
  const response = await apiClient.put<Budget>(`/budgets/${id}`, data);
  return response.data;
}

export async function deleteBudget(id: string): Promise<void> {
  await apiClient.delete(`/budgets/${id}`);
}

export {
  addBudgetRange,
  getBudgetRanges,
  updateBudgetRange,
  deleteBudgetRange,
} from './budgetRanges';
