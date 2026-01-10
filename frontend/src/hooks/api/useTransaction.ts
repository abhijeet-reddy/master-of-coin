import { useQuery } from '@tanstack/react-query';
import { getTransaction } from '@/services/transactionService';

/**
 * Fetch a single transaction by ID
 * Uses React Query for data fetching and caching
 *
 * @param id - Transaction ID
 * @returns React Query result with transaction data
 */
export default function useTransaction(id: string) {
  return useQuery({
    queryKey: ['transactions', id],
    queryFn: () => getTransaction(id),
    enabled: !!id,
  });
}
