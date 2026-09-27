import { useCallback, useMemo } from 'react';
import { useUrlState } from '@/lib/urlState';
import {
  clearedFilters,
  filterSchema,
  hasDateRange,
  monthKey,
  resolveMonth,
  shiftMonth,
  toListParams,
  type TxFilters,
} from '../lib/filters';

/**
 * Pins the ledger (the account, budget, category and person detail pages).
 * A pinned account, category or person hides and ignores that one filter;
 * with a fixed window (a budget period) the URL filters are ignored
 * altogether and only paging applies.
 */
export interface LedgerScope {
  accountId?: string;
  categoryId?: string;
  personId?: string;
  /** False hides Add transaction and Import (investment and archived accounts). */
  canAdd: boolean;
  /** Fixed server window, as instants; replaces the month and the filters. */
  window?: { start_date: string; end_date: string };
  sign?: 'positive' | 'negative';
  /** Empty-state text when nothing is in scope. */
  emptyNote?: string;
  /** Accessible name of the scoped month summary. */
  summaryLabel?: string;
}

/**
 * Filter state in the URL. Any filter change goes back to page 1; month
 * navigation clears an explicit date range (the two are alternatives).
 */
export function useTransactionFilters(scope?: LedgerScope) {
  const [raw, set] = useUrlState(filterSchema);
  const pinAccount = !!scope?.accountId;
  const pinCategory = !!scope?.categoryId;
  const pinPerson = !!scope?.personId;
  const fixed = !!scope?.window;
  const filters = useMemo(() => {
    if (fixed) return { ...raw, ...clearedFilters(), month: '', page: raw.page };
    if (!pinAccount && !pinCategory && !pinPerson) return raw;
    return {
      ...raw,
      ...(pinAccount ? { account: [] } : {}),
      ...(pinCategory ? { category: [] } : {}),
      ...(pinPerson ? { person: undefined } : {}),
    };
  }, [raw, pinAccount, pinCategory, pinPerson, fixed]);
  const month = resolveMonth(filters.month);
  const isCurrentMonth = month === monthKey(new Date());

  const setFilters = useCallback((patch: Partial<TxFilters>) => set({ page: 1, ...patch }), [set]);

  const goMonth = useCallback(
    (delta: number) => {
      set(
        (prev) => {
          const next = shiftMonth(resolveMonth(prev.month), delta);
          return {
            month: next === monthKey(new Date()) ? '' : next,
            from: undefined,
            to: undefined,
            page: 1,
          };
        },
        { history: 'push' }
      );
    },
    [set]
  );

  const setPage = useCallback((page: number) => set({ page }, { history: 'push' }), [set]);
  const clear = useCallback(() => set(clearedFilters()), [set]);

  const scopeId = scope?.accountId;
  const scopeCategory = scope?.categoryId;
  const scopePerson = scope?.personId;
  const scopeSign = scope?.sign;
  const winStart = scope?.window?.start_date;
  const winEnd = scope?.window?.end_date;
  const params = useMemo(() => {
    const p = toListParams(filters);
    if (scopeId) p.account_id = scopeId;
    if (scopeCategory) p.category_id = scopeCategory;
    if (scopePerson) p.person_id = scopePerson;
    if (scopeSign) p.sign = scopeSign;
    if (winStart && winEnd) {
      p.start_date = winStart;
      p.end_date = winEnd;
    }
    return p;
  }, [filters, scopeId, scopeCategory, scopePerson, scopeSign, winStart, winEnd]);

  return {
    scope,
    filters,
    month,
    isCurrentMonth,
    rangeActive: hasDateRange(filters),
    params,
    setFilters,
    goMonth,
    setPage,
    clear,
  };
}

export type TransactionFiltersApi = ReturnType<typeof useTransactionFilters>;
