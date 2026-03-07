import { useState, useMemo } from 'react';
import useBudget from '@/hooks/api/useBudget';
import useTransactions from '@/hooks/api/useTransactions';
import useEnrichedTransactions from '@/hooks/api/useEnrichedTransactions';
import useAccounts from '@/hooks/api/useAccounts';
import useCategories from '@/hooks/api/useCategories';
import useDeleteBudget from '@/hooks/api/useDeleteBudget';
import type { TransactionFilterValues } from '@/components/transactions/TransactionFilters';

const DEFAULT_FILTERS: TransactionFilterValues = {
  accountIds: [],
  categoryIds: [],
  transactionType: 'all',
};

/**
 * Custom hook managing all state and data for the Budget Detail page.
 * Fetches budget info and its associated transactions (filtered by budget's category/account filters).
 *
 * @param id - Budget ID from URL params
 */
export default function useBudgetDetail(id: string) {
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<TransactionFilterValues>(DEFAULT_FILTERS);

  // Fetch budget details
  const { data: budget, isLoading: isBudgetLoading, error: budgetError } = useBudget(id);

  // Build transaction query params from budget filters
  // Budget has filters.category_id and filters.account_ids
  const transactionQueryParams = useMemo(() => {
    if (!budget) return undefined;
    const params: Record<string, string | undefined> = {};
    if (budget.filters?.category_id) {
      params.category_id = budget.filters.category_id;
    }
    // Scope transactions to the active budget period
    if (budget.active_range?.start_date) {
      params.start_date = budget.active_range.start_date;
    }
    if (budget.active_range?.end_date) {
      params.end_date = budget.active_range.end_date;
    }
    return params;
  }, [budget]);

  // Fetch transactions matching budget filters (infinite scroll)
  const {
    data: transactionsData,
    isLoading: isTransactionsLoading,
    error: transactionsError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useTransactions(transactionQueryParams);

  // Flatten paginated data
  const allTransactions = transactionsData?.pages.flatMap((page) => page.data) ?? [];

  // Enrich transactions
  const enrichedTransactions = useEnrichedTransactions(allTransactions);

  // Data for filter dropdowns
  const { data: accountsData } = useAccounts();
  const { data: categoriesData } = useCategories();

  // Delete mutation
  const deleteMutation = useDeleteBudget();

  // Apply client-side filters
  const filteredTransactions = useMemo(() => {
    if (!enrichedTransactions) return [];

    return enrichedTransactions.filter((transaction) => {
      // Account filter
      if (filters.accountIds.length > 0 && !filters.accountIds.includes(transaction.account.id)) {
        return false;
      }

      // Category filter
      if (
        filters.categoryIds.length > 0 &&
        (!transaction.category || !filters.categoryIds.includes(transaction.category.id))
      ) {
        return false;
      }

      // Transaction type filter
      const amount = parseFloat(transaction.amount);
      if (filters.transactionType === 'income' && amount < 0) return false;
      if (filters.transactionType === 'expense' && amount > 0) return false;

      // Date range filter
      if (filters.startDate) {
        const transactionDate = new Date(transaction.date);
        const filterStart = new Date(filters.startDate);
        if (transactionDate < filterStart) return false;
      }

      if (filters.endDate) {
        const transactionDate = new Date(transaction.date);
        const filterEnd = new Date(filters.endDate);
        if (transactionDate > filterEnd) return false;
      }

      // Amount range filter
      const absAmount = Math.abs(amount);
      if (filters.minAmount && absAmount < parseFloat(filters.minAmount)) return false;
      if (filters.maxAmount && absAmount > parseFloat(filters.maxAmount)) return false;

      return true;
    });
  }, [enrichedTransactions, filters]);

  const toggleFilters = () => setShowFilters((prev) => !prev);
  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  return {
    budget,
    isLoading: isBudgetLoading,
    error: budgetError,
    filteredTransactions,
    isTransactionsLoading,
    transactionsError,
    fetchNextPage,
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
    filters,
    setFilters,
    showFilters,
    toggleFilters,
    clearFilters,
    accounts: accountsData ?? [],
    categories: categoriesData ?? [],
    deleteMutation,
  };
}
