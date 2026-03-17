import { useState, useMemo } from 'react';
import usePeople from '@/hooks/api/usePeople';
import useTransactions from '@/hooks/api/useTransactions';
import useEnrichedTransactions from '@/hooks/api/useEnrichedTransactions';
import useAccounts from '@/hooks/api/useAccounts';
import useCategories from '@/hooks/api/useCategories';
import useDeletePerson from '@/hooks/api/useDeletePerson';
import type { TransactionFilterValues } from '@/components/transactions/TransactionFilters';

const DEFAULT_FILTERS: TransactionFilterValues = {
  accountIds: [],
  categoryIds: [],
  transactionType: 'all',
};

/**
 * Custom hook managing all state and data for the Person Detail page.
 * Uses the cached people list to find the person by ID (no separate API call needed).
 *
 * @param id - Person ID from URL params
 */
export default function usePersonDetail(id: string) {
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<TransactionFilterValues>(DEFAULT_FILTERS);

  // Fetch all people (cached by React Query) and find the one we need
  const { data: people, isLoading: isPeopleLoading, error: peopleError } = usePeople();

  const person = useMemo(() => people?.find((p) => p.id === id), [people, id]);

  // Fetch transactions filtered by this person (infinite scroll)
  const {
    data: transactionsData,
    isLoading: isTransactionsLoading,
    error: transactionsError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useTransactions({ person_id: id });

  // Flatten paginated data
  const allTransactions = transactionsData?.pages.flatMap((page) => page.data) ?? [];

  // Enrich transactions with account/category details
  const enrichedTransactions = useEnrichedTransactions(allTransactions);

  // Accounts and categories for filter dropdowns
  const { data: accountsData } = useAccounts();
  const { data: categoriesData } = useCategories();

  // Delete mutation
  const deleteMutation = useDeletePerson();

  // Apply client-side filters (account, category, type, date range, amount)
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

      // Paid by others filter
      if (filters.paidByOthers === 'only' && !transaction.debt_metadata) return false;
      if (filters.paidByOthers === 'exclude' && transaction.debt_metadata) return false;

      return true;
    });
  }, [enrichedTransactions, filters]);

  const toggleFilters = () => setShowFilters((prev) => !prev);
  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  return {
    person,
    isLoading: isPeopleLoading,
    error: peopleError,
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
