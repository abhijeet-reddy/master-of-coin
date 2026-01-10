import { useQuery } from '@tanstack/react-query';
import { getAccount } from '@/services/accountService';

/**
 * Fetch a single account by ID
 * Uses React Query for data fetching and caching
 *
 * @param id - Account ID
 * @returns React Query result with account data
 */
export default function useAccount(id: string) {
  return useQuery({
    queryKey: ['accounts', id],
    queryFn: () => getAccount(id),
    enabled: !!id,
  });
}
