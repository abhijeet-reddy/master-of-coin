import { useInfiniteQuery } from '@tanstack/react-query';
import { getTransactions } from '@/services/transactionService';
import type { QueryParams } from '@/types/api';

/**
 * Hook to fetch transactions with infinite scroll pagination
 * Uses React Query's useInfiniteQuery for automatic pagination handling
 *
 * @param filters - Optional filters for transactions (date range, account, category, etc.)
 * @returns React Query infinite query result with transactions data
 */
export default function useTransactions(filters?: QueryParams) {
  return useInfiniteQuery({
    queryKey: ['transactions', filters],
    queryFn: ({ pageParam = 0 }) =>
      getTransactions({
        ...filters,
        offset: pageParam,
        limit: 50,
      }),
    getNextPageParam: (lastPage) => {
      // If has_more is true, return the next offset
      if (lastPage.pagination.has_more) {
        return lastPage.pagination.offset + lastPage.pagination.limit;
      }
      // Otherwise, return undefined to indicate no more pages
      return undefined;
    },
    initialPageParam: 0,
  });
}
