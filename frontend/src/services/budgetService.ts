import apiClient from '@/lib/axios';
import type { Budget, CreateBudgetRequest, ApiResponse } from '@/types';

/**
 * Get all budgets with optional active filter
 */
export async function getBudgets(params?: { active?: boolean }): Promise<Budget[]> {
  const response = await apiClient.get<ApiResponse<Budget[]>>('/budgets', { params });
  return response.data.data;
}

/**
 * Get a single budget by ID
 */
export async function getBudget(id: string): Promise<Budget> {
  const response = await apiClient.get<ApiResponse<Budget>>(`/budgets/${id}`);
  return response.data.data;
}

/**
 * Create a new budget
 */
export async function createBudget(data: CreateBudgetRequest): Promise<Budget> {
  const response = await apiClient.post<ApiResponse<Budget>>('/budgets', data);
  return response.data.data;
}

/**
 * Update an existing budget
 */
export async function updateBudget(
  id: string,
  data: Partial<CreateBudgetRequest>
): Promise<Budget> {
  const response = await apiClient.put<ApiResponse<Budget>>(`/budgets/${id}`, data);
  return response.data.data;
}

/**
 * Delete a budget
 */
export async function deleteBudget(id: string): Promise<void> {
  await apiClient.delete(`/budgets/${id}`);
}

/**
 * Add a new range to an existing budget
 */
export async function addBudgetRange(
  budgetId: string,
  data: {
    limit_amount: string;
    period: string;
    start_date: string;
    end_date?: string;
  }
): Promise<Budget> {
  const response = await apiClient.post<ApiResponse<Budget>>(`/budgets/${budgetId}/ranges`, data);
  return response.data.data;
}
