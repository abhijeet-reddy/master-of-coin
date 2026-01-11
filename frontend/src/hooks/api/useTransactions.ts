import { useQuery } from '@tanstack/react-query';
import { getTransactions } from '@/services/transactionService';
import type { QueryParams } from '@/types/api';

/**
 * Hook to fetch transactions with optional filters
 * Uses React Query for data fetching and caching
 *
 * @param filters - Optional filters for transactions (date range, account, category, etc.)
 * @returns React Query result with transactions data
 */
export default function useTransactions(filters?: QueryParams) {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => getTransactions(filters),
  });
}
