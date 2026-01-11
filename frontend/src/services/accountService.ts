import apiClient from '@/lib/axios';
import type { Account, ApiResponse } from '@/types';

/**
 * Get all accounts for the current user
 */
export async function getAccounts(): Promise<Account[]> {
  const response = await apiClient.get<Account[]>('/accounts');
  return response.data;
}

/**
 * Get a single account by ID
 */
export async function getAccount(id: string): Promise<Account> {
  const response = await apiClient.get<ApiResponse<Account>>(`/accounts/${id}`);
  return response.data.data;
}

/**
 * Create a new account
 */
export async function createAccount(data: {
  name: string;
  type: string;
  currency: string;
  notes?: string;
}): Promise<Account> {
  const response = await apiClient.post<ApiResponse<Account>>('/accounts', data);
  return response.data.data;
}

/**
 * Update an existing account
 */
export async function updateAccount(
  id: string,
  data: Partial<{
    name: string;
    type: string;
    currency: string;
    notes: string;
  }>
): Promise<Account> {
  const response = await apiClient.put<ApiResponse<Account>>(`/accounts/${id}`, data);
  return response.data.data;
}

/**
 * Delete an account
 */
export async function deleteAccount(id: string): Promise<void> {
  await apiClient.delete(`/accounts/${id}`);
}
