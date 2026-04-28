import { useState, useMemo } from 'react';
import useAccount from '@/hooks/api/useAccount';
import useTransactions from '@/hooks/api/useTransactions';
import useEnrichedTransactions from '@/hooks/api/useEnrichedTransactions';
import useCategories from '@/hooks/api/useCategories';
import useDeleteAccount from '@/hooks/api/useDeleteAccount';
import {
  UNCATEGORISED_FILTER_ID,
  type TransactionFilterValues,
} from '@/components/transactions/TransactionFilters';

const DEFAULT_FILTERS: TransactionFilterValues = {
  accountIds: [],
  categoryIds: [],
  transactionType: 'all',
};

/**
 * Custom hook managing all state and data for the Account Detail page.
 * Follows React rules: extracts logic from the page component into a hook.
 *
 * @param id - Account ID from URL params
 */
export default function useAccountDetail(id: string) {
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<TransactionFilterValues>(DEFAULT_FILTERS);

  // Fetch account details
  const { data: account, isLoading: isAccountLoading, error: accountError } = useAccount(id);

  // Fetch transactions filtered by this account (infinite scroll)
  const {
    data: transactionsData,
    isLoading: isTransactionsLoading,
    error: transactionsError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useTransactions({ account_id: id });

  // Flatten paginated data
  const allTransactions = transactionsData?.pages.flatMap((page) => page.data) ?? [];

  // Enrich transactions with account/category details
  const enrichedTransactions = useEnrichedTransactions(allTransactions);

  // Categories for filter dropdown
  const { data: categoriesData } = useCategories();

  // Delete mutation
  const deleteMutation = useDeleteAccount();

  // Apply client-side filters (category, type, date range, amount)
  const filteredTransactions = useMemo(() => {
    if (!enrichedTransactions) return [];

    return enrichedTransactions.filter((transaction) => {
      // Category filter (supports a sentinel for uncategorised transactions)
      if (filters.categoryIds.length > 0) {
        const matches = transaction.category
          ? filters.categoryIds.includes(transaction.category.id)
          : filters.categoryIds.includes(UNCATEGORISED_FILTER_ID);
        if (!matches) return false;
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
    // Account data
    account,
    isLoading: isAccountLoading,
    error: accountError,

    // Transactions
    filteredTransactions,
    isTransactionsLoading,
    transactionsError,
    fetchNextPage,
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,

    // Filters
    filters,
    setFilters,
    showFilters,
    toggleFilters,
    clearFilters,
    categories: categoriesData ?? [],

    // Delete
    deleteMutation,
  };
}
