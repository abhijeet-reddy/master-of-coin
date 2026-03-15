import { useInfiniteQuery } from '@tanstack/react-query';
import { getTrashTransactions } from '@/services/transactionService';

/**
 * Hook to fetch soft-deleted (trashed) transactions with infinite scroll pagination
 * Uses React Query's useInfiniteQuery for automatic pagination handling
 *
 * @returns React Query infinite query result with trashed transactions data
 */
export default function useTrashTransactions() {
  return useInfiniteQuery({
    queryKey: ['transactions', 'trash'],
    queryFn: ({ pageParam = 0 }) =>
      getTrashTransactions({
        offset: pageParam,
        limit: 50,
      }),
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination.has_more) {
        return lastPage.pagination.offset + lastPage.pagination.limit;
      }
      return undefined;
    },
    initialPageParam: 0,
  });
}
