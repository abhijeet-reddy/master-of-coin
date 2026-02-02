import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateApiKey } from '@/services/apiKeyService';
import type { UpdateApiKeyRequest } from '@/models/apiKey';

/**
 * Update an existing API key
 * Invalidates api-keys query on success
 *
 * @returns React Query mutation for updating API keys
 */
export default function useUpdateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateApiKeyRequest }) => updateApiKey(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });
}
