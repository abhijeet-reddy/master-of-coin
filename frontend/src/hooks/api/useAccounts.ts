import { useQuery } from '@tanstack/react-query';
import { getAccounts } from '@/services/accountService';

/**
 * Fetch all accounts for the current user
 * Uses React Query for data fetching and caching
 *
 * @returns React Query result with accounts data
 */
export default function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  });
}
