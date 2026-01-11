import apiClient from '@/lib/axios';
import type { Person, PersonDebtDetail, ApiResponse } from '@/types';

/**
 * Get all people with debt summaries
 */
export async function getPeople(): Promise<Person[]> {
  const response = await apiClient.get<Person[]>('/people');
  return response.data;
}

/**
 * Get a single person by ID
 */
export async function getPerson(id: string): Promise<Person> {
  const response = await apiClient.get<ApiResponse<Person>>(`/people/${id}`);
  return response.data.data;
}

/**
 * Get detailed debt information for a person
 */
export async function getPersonDebts(id: string): Promise<PersonDebtDetail> {
  const response = await apiClient.get<ApiResponse<PersonDebtDetail>>(`/people/${id}/debts`);
  return response.data.data;
}

/**
 * Create a new person
 */
export async function createPerson(data: {
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
}): Promise<Person> {
  const response = await apiClient.post<ApiResponse<Person>>('/people', data);
  return response.data.data;
}

/**
 * Update an existing person
 */
export async function updatePerson(
  id: string,
  data: Partial<{
    name: string;
    email: string;
    phone: string;
    notes: string;
  }>
): Promise<Person> {
  const response = await apiClient.put<ApiResponse<Person>>(`/people/${id}`, data);
  return response.data.data;
}

/**
 * Delete a person
 */
export async function deletePerson(id: string): Promise<void> {
  await apiClient.delete(`/people/${id}`);
}

/**
 * Settle debt with a person
 */
export async function settleDebt(
  personId: string,
  data: {
    account_id: string;
    notes?: string;
  }
): Promise<{ settlement_transaction: unknown; new_balance: string }> {
  const response = await apiClient.post<
    ApiResponse<{ settlement_transaction: unknown; new_balance: string }>
  >(`/people/${personId}/settle`, data);
  return response.data.data;
}
