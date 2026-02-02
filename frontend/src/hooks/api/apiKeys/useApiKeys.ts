import { useQuery } from '@tanstack/react-query';
import { listApiKeys } from '@/services/apiKeyService';

/**
 * Fetch all API keys for the current user
 * Uses React Query for data fetching and caching
 *
 * @returns React Query result with API keys data
 */
export default function useApiKeys() {
  return useQuery({
    queryKey: ['api-keys'],
    queryFn: listApiKeys,
  });
}
