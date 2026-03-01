import { useState, useMemo } from 'react';
import useCategories from '@/hooks/api/useCategories';
import useTransactions from '@/hooks/api/useTransactions';
import useEnrichedTransactions from '@/hooks/api/useEnrichedTransactions';
import useAccounts from '@/hooks/api/useAccounts';
import useDeleteCategory from '@/hooks/api/useDeleteCategory';
import type { TransactionFilterValues } from '@/components/transactions/TransactionFilters';

const DEFAULT_FILTERS: TransactionFilterValues = {
  accountIds: [],
  categoryIds: [],
  transactionType: 'all',
};

/**
 * Custom hook managing all state and data for the Category Detail page.
 * Uses the cached categories list to find the category by ID (no separate API call needed).
 *
 * @param id - Category ID from URL params
 */
export default function useCategoryDetail(id: string) {
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<TransactionFilterValues>(DEFAULT_FILTERS);

  // Fetch all categories (cached by React Query) and find the one we need
  const { data: categories, isLoading: isCategoryLoading, error: categoryError } = useCategories();

  const category = useMemo(() => categories?.find((c) => c.id === id), [categories, id]);

  // Fetch transactions filtered by this category (infinite scroll)
  const {
    data: transactionsData,
    isLoading: isTransactionsLoading,
    error: transactionsError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useTransactions({ category_id: id });

  // Flatten paginated data
  const allTransactions = transactionsData?.pages.flatMap((page) => page.data) ?? [];

  // Enrich transactions with account/category details
  const enrichedTransactions = useEnrichedTransactions(allTransactions);

  // Accounts for filter dropdown
  const { data: accountsData } = useAccounts();

  // Delete mutation
  const deleteMutation = useDeleteCategory();

  // Apply client-side filters (account, type, date range, amount)
  const filteredTransactions = useMemo(() => {
    if (!enrichedTransactions) return [];

    return enrichedTransactions.filter((transaction) => {
      // Account filter
      if (filters.accountIds.length > 0 && !filters.accountIds.includes(transaction.account.id)) {
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

      // Paid by others filter
      if (filters.paidByOthers === 'only' && !transaction.debt_metadata) return false;
      if (filters.paidByOthers === 'exclude' && transaction.debt_metadata) return false;

      return true;
    });
  }, [enrichedTransactions, filters]);

  const toggleFilters = () => setShowFilters((prev) => !prev);
  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  return {
    category,
    isLoading: isCategoryLoading,
    error: categoryError,
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
    deleteMutation,
  };
}
