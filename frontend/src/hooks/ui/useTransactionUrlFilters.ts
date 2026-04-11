import { useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { TransactionFilterValues } from '@/components/transactions/TransactionFilters';
import {
  filtersToSearchParams,
  searchParamsToFilters,
  searchParamsToMonth,
  hasActiveFilterParams,
} from '@/utils/urlFilterParams';

interface UseTransactionUrlFiltersReturn {
  /** The selected month parsed from URL (defaults to current month). */
  selectedMonth: Date;
  /** Transaction filter values parsed from URL. */
  filters: TransactionFilterValues;
  /** True when any non-month filter param is present in the URL. */
  hasUrlFilters: boolean;

  /** Updates the month param in the URL (push navigation for back/forward). */
  setSelectedMonth: (date: Date) => void;
  /** Serializes filter values to URL params (replace navigation). */
  setFilters: (filters: TransactionFilterValues) => void;
  /** Removes all filter params, keeping month if non-default. */
  clearFilters: () => void;
}

/**
 * Syncs transaction filter state with URL search parameters.
 *
 * Reads filter + month state from the URL and provides setters that
 * update the URL. This makes filters bookmarkable and shareable.
 *
 * CONSTRAINT: Uses exactly 1 useSearchParams (React Router state).
 */
export default function useTransactionUrlFilters(): UseTransactionUrlFiltersReturn {
  const [searchParams, setSearchParams] = useSearchParams();

  // Derive selected month from URL
  const selectedMonth = useMemo(() => searchParamsToMonth(searchParams), [searchParams]);

  // Derive filters from URL
  const filters = useMemo(() => searchParamsToFilters(searchParams), [searchParams]);

  // Derive whether URL has active filter params
  const hasUrlFilters = useMemo(() => hasActiveFilterParams(searchParams), [searchParams]);

  // Update month — uses push navigation so back/forward works between months
  const setSelectedMonth = useCallback(
    (date: Date) => {
      const newParams = filtersToSearchParams(filters, date);
      setSearchParams(newParams);
    },
    [filters, setSearchParams]
  );

  // Update filters — uses replace to avoid polluting history with every toggle
  const setFilters = useCallback(
    (newFilters: TransactionFilterValues) => {
      const newParams = filtersToSearchParams(newFilters, selectedMonth);
      setSearchParams(newParams, { replace: true });
    },
    [selectedMonth, setSearchParams]
  );

  // Clear all filters, keep month if non-default
  const clearFilters = useCallback(() => {
    const defaultFilters: TransactionFilterValues = {
      accountIds: [],
      categoryIds: [],
      transactionType: 'all',
    };
    const newParams = filtersToSearchParams(defaultFilters, selectedMonth);
    setSearchParams(newParams, { replace: true });
  }, [selectedMonth, setSearchParams]);

  return {
    selectedMonth,
    filters,
    hasUrlFilters,
    setSelectedMonth,
    setFilters,
    clearFilters,
  };
}
