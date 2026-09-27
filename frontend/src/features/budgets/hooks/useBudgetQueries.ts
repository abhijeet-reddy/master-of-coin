/** Every read the budgets feature makes. Keys come from `api/keys`, shared with the shell and v1. */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getAccounts } from '@/api/accounts';
import { getBudget, getBudgetRanges, getBudgets } from '@/api/budgets';
import { getCategories } from '@/api/categories';
import { keys } from '@/api/keys';
import { getTransactions } from '@/api/transactions';
import type { BudgetFilters, QueryParams } from '@/api/types';

const MINUTE = 60_000;
/** The server's page cap; enough for one budget period's spending. */
const PERIOD_TX_LIMIT = 1000;

export const useBudgets = () => useQuery({ queryKey: keys.budgets.list(), queryFn: getBudgets });

export const useBudget = (id: string | undefined) =>
  useQuery({
    queryKey: keys.budgets.detail(id ?? ''),
    queryFn: () => getBudget(id!),
    enabled: !!id,
  });

export const useBudgetRanges = (id: string | undefined) =>
  useQuery({
    queryKey: keys.budgets.ranges(id ?? ''),
    queryFn: () => getBudgetRanges(id!),
    enabled: !!id,
  });

export const useCategories = () =>
  useQuery({ queryKey: keys.categories.all, queryFn: getCategories, staleTime: 5 * MINUTE });

/** Default GET /accounts: archived accounts are left out, so the pickers never offer them. */
export const useAccounts = () => useQuery({ queryKey: keys.accounts.all, queryFn: getAccounts });

/** Money out in the budget's current window, for the pace chart. */
export function usePeriodSpend(
  window: { start: string; end: string } | null,
  filters: BudgetFilters | undefined
) {
  const params: QueryParams = {
    start_date: window ? `${window.start}T00:00:00Z` : '',
    end_date: window ? `${window.end}T23:59:59Z` : '',
    sign: 'negative',
    ...(filters?.category_id ? { category_id: filters.category_id } : {}),
    ...(filters?.account_id ? { account_id: filters.account_id } : {}),
    limit: PERIOD_TX_LIMIT,
    offset: 0,
  };
  return useQuery({
    queryKey: keys.transactions.list(params),
    queryFn: () => getTransactions(params),
    enabled: !!window,
    placeholderData: keepPreviousData,
  });
}
