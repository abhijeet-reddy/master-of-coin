import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createApiKey } from '@/services/apiKeyService';
import type { CreateApiKeyRequest } from '@/models/apiKey';

/**
 * Create a new API key
 * Invalidates api-keys query on success
 *
 * @returns React Query mutation for creating API keys
 */
export default function useCreateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateApiKeyRequest) => createApiKey(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });
}
