import { useMutation, useQueryClient } from '@tanstack/react-query';
import { revokeApiKey } from '@/services/apiKeyService';

/**
 * Revoke an API key
 * Invalidates api-keys query on success
 *
 * @returns React Query mutation for revoking API keys
 */
export default function useRevokeApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => revokeApiKey(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });
}
