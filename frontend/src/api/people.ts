import { apiClient, toApiError } from './client';
import type { Person, PersonDebt, PersonSplitConfig, SetPersonSplitConfigRequest } from './types';

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
  const response = await apiClient.get<Person>(`/people/${id}`);
  return response.data;
}

/** The net debt with a person (positive: they owe me). */
export async function getPersonDebts(id: string): Promise<PersonDebt> {
  const response = await apiClient.get<PersonDebt>(`/people/${id}/debts`);
  return response.data;
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
  // The server returns the person itself, not an `{ data }` envelope.
  const response = await apiClient.post<Person>('/people', data);
  return response.data;
}

/**
 * Update an existing person
 */
/** Update data where nullable fields can be set to null to clear them */
export type UpdatePersonData = {
  name?: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
};

export async function updatePerson(id: string, data: UpdatePersonData): Promise<Person> {
  const response = await apiClient.put<Person>(`/people/${id}`, data);
  return response.data;
}

/**
 * Delete a person
 */
export async function deletePerson(id: string): Promise<void> {
  await apiClient.delete(`/people/${id}`);
}

/**
 * Settle debt with a person: records a payment of `amount` on the account, in
 * whichever direction the debt runs. The server answers 204 and does not cap
 * the amount, so callers keep it within the current net.
 */
export async function settleDebt(
  personId: string,
  data: { amount: number; account_id: string }
): Promise<void> {
  await apiClient.post(`/people/${personId}/settle`, data);
}

// --- Split provider configuration ---

/**
 * Get split provider configuration for a person
 * @param personId - Person ID
 * @returns Split config or null if not configured
 */
export async function getPersonSplitConfig(personId: string): Promise<PersonSplitConfig | null> {
  try {
    const response = await apiClient.get<PersonSplitConfig>(`/people/${personId}/split-config`);
    return response.data;
  } catch (err) {
    // 404 means the person is not linked; it is not an error.
    if (toApiError(err).status === 404) return null;
    throw err;
  }
}

/**
 * Set (create or update) split provider configuration for a person
 * @param personId - Person ID
 * @param config - Provider ID and external user ID
 * @returns Updated split config
 */
export async function setPersonSplitConfig(
  personId: string,
  config: SetPersonSplitConfigRequest
): Promise<PersonSplitConfig> {
  const response = await apiClient.put<PersonSplitConfig>(
    `/people/${personId}/split-config`,
    config
  );
  return response.data;
}

/**
 * Delete split provider configuration for a person
 * @param personId - Person ID
 */
export async function deletePersonSplitConfig(personId: string): Promise<void> {
  await apiClient.delete(`/people/${personId}/split-config`);
}
