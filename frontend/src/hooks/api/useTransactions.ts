import { useQuery } from '@tanstack/react-query';
import { transactionService } from '@/services/transactionService';
import type { TransactionFilters } from '@/types/api';

/**
 * Hook to fetch transactions with optional filters
 * Uses React Query for data fetching and caching
 *
 * @param filters - Optional filters for transactions (date range, account, category, etc.)
 * @returns React Query result with transactions data
 */
export default function useTransactions(filters?: TransactionFilters) {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => transactionService.getAll(filters),
  });
}
