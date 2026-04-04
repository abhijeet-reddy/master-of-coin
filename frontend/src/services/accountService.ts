import apiClient from '@/lib/axios';
import type { Account } from '@/types';

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
  const response = await apiClient.get<Account>(`/accounts/${id}`);
  return response.data;
}

/**
 * Create a new account
 */
export async function createAccount(data: {
  name: string;
  account_type: string;
  currency: string;
  initial_balance?: number;
  notes?: string;
}): Promise<Account> {
  const response = await apiClient.post<Account>('/accounts', data);
  return response.data;
}

/**
 * Update an existing account
 */
export async function updateAccount(
  id: string,
  data: Partial<{
    name: string;
    account_type: string;
    currency: string;
    notes: string;
  }>
): Promise<Account> {
  const response = await apiClient.put<Account>(`/accounts/${id}`, data);
  return response.data;
}

/**
 * Delete an account
 */
export async function deleteAccount(id: string): Promise<void> {
  await apiClient.delete(`/accounts/${id}`);
}

/**
 * Set the balance of an investment account.
 * The server calculates the difference between the current balance and the
 * requested balance, then creates an adjustment transaction if needed.
 */
export async function updateAccountBalance(id: string, balance: number): Promise<Account> {
  const response = await apiClient.put<Account>(`/accounts/${id}/balance`, { balance });
  return response.data;
}
