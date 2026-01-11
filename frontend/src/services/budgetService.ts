import apiClient from '@/lib/axios';
import type { Budget, CreateBudgetRequest, ApiResponse } from '@/types';

/**
 * Get all budgets with optional active filter
 */
export async function getBudgets(params?: { active?: boolean }): Promise<Budget[]> {
  const response = await apiClient.get<Budget[]>('/budgets', { params });
  return response.data;
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
 * Note: Backend expects a two-step process:
 * 1. Create budget with name and filters
 * 2. Add ranges separately via POST /budgets/:id/ranges
 */
export async function createBudget(data: CreateBudgetRequest): Promise<Budget> {
  // Step 1: Create the budget (name and filters only)
  const budgetPayload = {
    name: data.name,
    filters: data.filters,
  };

  const budgetResponse = await apiClient.post<Budget>('/budgets', budgetPayload);
  const createdBudget = budgetResponse.data;

  // Step 2: Add ranges if provided
  if (data.ranges && data.ranges.length > 0) {
    for (const range of data.ranges) {
      await addBudgetRange(createdBudget.id, range);
    }
  }

  return createdBudget;
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
): Promise<void> {
  // Convert limit_amount from string to number for backend
  const rangePayload = {
    limit_amount: parseFloat(data.limit_amount),
    period: data.period,
    start_date: data.start_date,
    end_date: data.end_date,
  };

  await apiClient.post(`/budgets/${budgetId}/ranges`, rangePayload);
}
