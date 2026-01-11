import apiClient from '@/lib/axios';
import type {
  Transaction,
  CreateTransactionRequest,
  UpdateTransactionRequest,
  PaginatedResponse,
  QueryParams,
  ApiResponse,
} from '@/types';

/**
 * Get transactions with optional filters
 */
export async function getTransactions(
  params?: QueryParams
): Promise<PaginatedResponse<Transaction>> {
  const response = await apiClient.get<Transaction[]>('/transactions', { params });

  // Backend returns a simple array directly (not wrapped in ApiResponse)
  const transactions = response.data;
  return {
    data: transactions,
    pagination: {
      total: transactions.length,
      limit: params?.limit || 100,
      offset: params?.offset || 0,
      has_more: false,
    },
  };
}

/**
 * Get a single transaction by ID
 */
export async function getTransaction(id: string): Promise<Transaction> {
  const response = await apiClient.get<ApiResponse<Transaction>>(`/transactions/${id}`);
  return response.data.data;
}

/**
 * Create a new transaction
 */
export async function createTransaction(data: CreateTransactionRequest): Promise<Transaction> {
  const response = await apiClient.post<ApiResponse<Transaction>>('/transactions', data);
  return response.data.data;
}

/**
 * Update an existing transaction
 */
export async function updateTransaction(
  id: string,
  data: UpdateTransactionRequest
): Promise<Transaction> {
  const response = await apiClient.put<ApiResponse<Transaction>>(`/transactions/${id}`, data);
  return response.data.data;
}

/**
 * Delete a transaction
 */
export async function deleteTransaction(id: string): Promise<void> {
  await apiClient.delete(`/transactions/${id}`);
}
