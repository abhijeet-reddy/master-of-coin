import type { TransactionFilterValues } from '@/components/transactions/TransactionFilters';

/**
 * URL parameter keys used for transaction filters.
 */
const PARAM_KEYS = {
  month: 'month',
  accounts: 'accounts',
  categories: 'categories',
  type: 'type',
  startDate: 'startDate',
  endDate: 'endDate',
  minAmount: 'minAmount',
  maxAmount: 'maxAmount',
  paidByOthers: 'paidByOthers',
} as const;

/** All param keys that represent filters (everything except month). */
const FILTER_PARAM_KEYS = [
  PARAM_KEYS.accounts,
  PARAM_KEYS.categories,
  PARAM_KEYS.type,
  PARAM_KEYS.startDate,
  PARAM_KEYS.endDate,
  PARAM_KEYS.minAmount,
  PARAM_KEYS.maxAmount,
  PARAM_KEYS.paidByOthers,
] as const;

/**
 * Returns true if the given date falls within the current calendar month.
 */
export function isCurrentMonth(date: Date): boolean {
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

/**
 * Formats a Date as `YYYY-MM` for the month URL param.
 */
function formatMonthParam(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Parses a `YYYY-MM` string into a Date (first day of that month).
 * Returns null if the string is invalid.
 */
function parseMonthParam(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1; // 0-indexed

  if (month < 0 || month > 11) return null;

  const date = new Date(year, month, 1);
  // Verify the date is valid
  if (isNaN(date.getTime())) return null;

  return date;
}

/**
 * Converts TransactionFilterValues + selectedMonth into URLSearchParams.
 * Default/empty values are omitted to keep URLs clean.
 */
export function filtersToSearchParams(
  filters: TransactionFilterValues,
  selectedMonth: Date
): URLSearchParams {
  const params = new URLSearchParams();

  // Month — omit if current month
  if (!isCurrentMonth(selectedMonth)) {
    params.set(PARAM_KEYS.month, formatMonthParam(selectedMonth));
  }

  // Account IDs — omit if empty
  if (filters.accountIds.length > 0) {
    params.set(PARAM_KEYS.accounts, filters.accountIds.join(','));
  }

  // Category IDs — omit if empty
  if (filters.categoryIds.length > 0) {
    params.set(PARAM_KEYS.categories, filters.categoryIds.join(','));
  }

  // Transaction type — omit if 'all' or undefined
  if (filters.transactionType && filters.transactionType !== 'all') {
    params.set(PARAM_KEYS.type, filters.transactionType);
  }

  // Date range — omit if not set
  if (filters.startDate) {
    params.set(PARAM_KEYS.startDate, filters.startDate);
  }
  if (filters.endDate) {
    params.set(PARAM_KEYS.endDate, filters.endDate);
  }

  // Amount range — omit if not set
  if (filters.minAmount) {
    params.set(PARAM_KEYS.minAmount, filters.minAmount);
  }
  if (filters.maxAmount) {
    params.set(PARAM_KEYS.maxAmount, filters.maxAmount);
  }

  // Paid by others — omit if 'all' or undefined
  if (filters.paidByOthers && filters.paidByOthers !== 'all') {
    params.set(PARAM_KEYS.paidByOthers, filters.paidByOthers);
  }

  return params;
}

/**
 * Parses URLSearchParams into TransactionFilterValues.
 * Invalid values silently fall back to defaults.
 */
export function searchParamsToFilters(params: URLSearchParams): TransactionFilterValues {
  const accountsParam = params.get(PARAM_KEYS.accounts);
  const categoriesParam = params.get(PARAM_KEYS.categories);
  const typeParam = params.get(PARAM_KEYS.type);
  const paidByOthersParam = params.get(PARAM_KEYS.paidByOthers);

  // Parse account IDs
  const accountIds = accountsParam ? accountsParam.split(',').filter(Boolean) : [];

  // Parse category IDs
  const categoryIds = categoriesParam ? categoriesParam.split(',').filter(Boolean) : [];

  // Parse transaction type — validate against allowed values
  let transactionType: 'all' | 'income' | 'expense' = 'all';
  if (typeParam === 'income' || typeParam === 'expense') {
    transactionType = typeParam;
  }

  // Parse paid by others — validate against allowed values
  let paidByOthers: 'all' | 'only' | 'exclude' = 'all';
  if (paidByOthersParam === 'only' || paidByOthersParam === 'exclude') {
    paidByOthers = paidByOthersParam;
  }

  return {
    accountIds,
    categoryIds,
    transactionType,
    startDate: params.get(PARAM_KEYS.startDate) || undefined,
    endDate: params.get(PARAM_KEYS.endDate) || undefined,
    minAmount: params.get(PARAM_KEYS.minAmount) || undefined,
    maxAmount: params.get(PARAM_KEYS.maxAmount) || undefined,
    paidByOthers,
  };
}

/**
 * Parses the `month` URL param into a Date.
 * Returns the current month if the param is missing or invalid.
 */
export function searchParamsToMonth(params: URLSearchParams): Date {
  const monthParam = params.get(PARAM_KEYS.month);
  if (!monthParam) return new Date();

  const parsed = parseMonthParam(monthParam);
  return parsed ?? new Date();
}

/**
 * Returns true if any non-month filter param is present in the URL.
 * Used to determine whether the filter panel should auto-open.
 */
export function hasActiveFilterParams(params: URLSearchParams): boolean {
  return FILTER_PARAM_KEYS.some((key) => params.has(key));
}
