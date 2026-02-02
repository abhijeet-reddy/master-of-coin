import apiClient from '@/lib/axios';
import type {
  ApiKey,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  ListApiKeysResponse,
  UpdateApiKeyRequest,
} from '@/models/apiKey';

/**
 * Create a new API key
 */
export async function createApiKey(data: CreateApiKeyRequest): Promise<CreateApiKeyResponse> {
  const response = await apiClient.post<CreateApiKeyResponse>('/api-keys', data);
  return response.data;
}

/**
 * Get all API keys for the current user
 */
export async function listApiKeys(): Promise<ApiKey[]> {
  const response = await apiClient.get<ListApiKeysResponse>('/api-keys');
  return response.data.api_keys;
}

/**
 * Get a single API key by ID
 */
export async function getApiKey(id: string): Promise<ApiKey> {
  const response = await apiClient.get<ApiKey>(`/api-keys/${id}`);
  return response.data;
}

/**
 * Update an existing API key
 */
export async function updateApiKey(id: string, data: UpdateApiKeyRequest): Promise<ApiKey> {
  const response = await apiClient.patch<ApiKey>(`/api-keys/${id}`, data);
  return response.data;
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(id: string): Promise<void> {
  await apiClient.delete(`/api-keys/${id}`);
}
