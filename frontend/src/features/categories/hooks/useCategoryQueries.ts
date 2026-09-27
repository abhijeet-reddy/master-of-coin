/** Every read the categories feature makes. Keys come from `api/keys`. */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getCategories } from '@/api/categories';
import { keys } from '@/api/keys';
import { getTransactions } from '@/api/transactions';
import type { QueryParams } from '@/api/types';
import { useLedgerContext } from '@/features/transactions/hooks/useTxQueries';
import { lastMonths, monthsWindow } from '../lib/categoriesModel';

const MINUTE = 60_000;
/** The server's page cap. */
const TX_LIMIT = 1000;

export const useCategories = () =>
  useQuery({ queryKey: keys.categories.all, queryFn: getCategories, staleTime: 5 * MINUTE });

/** No GET /categories/:id exists: the category comes out of the cached list. */
export function useCategory(id: string) {
  const list = useCategories();
  const category = useMemo(() => list.data?.find((c) => c.id === id), [list.data, id]);
  return { ...list, category, notFound: !!list.data && !category };
}

/** Money out over the last `months` months, optionally for one category. */
export function useSpend(months: number, categoryId?: string) {
  const axis = useMemo(() => lastMonths(months), [months]);
  const params: QueryParams = {
    ...monthsWindow(axis),
    sign: 'negative',
    ...(categoryId ? { category_id: categoryId } : {}),
    limit: TX_LIMIT,
    offset: 0,
  };
  const query = useQuery({
    queryKey: keys.transactions.list(params),
    queryFn: () => getTransactions(params),
    placeholderData: keepPreviousData,
  });
  const ctx = useLedgerContext();
  const truncated = !!query.data && query.data.pagination.total > query.data.data.length;
  return { query, axis, ctx, truncated };
}
