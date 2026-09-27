/**
 * Every query the transactions feature reads. Keys come from `api/keys`, so the
 * shell, the dashboard and the ledger share the same cache entries.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getAccounts } from '@/api/accounts';
import { getMonthlyTotals } from '@/api/analytics';
import { getCategories } from '@/api/categories';
import { fetchExchangeRates } from '@/api/exchangeRates';
import { keys } from '@/api/keys';
import { getPeople } from '@/api/people';
import { getSyncStatus } from '@/api/splitSync';
import { getTransaction, getTransactions } from '@/api/transactions';
import { getConvertCandidates } from '@/api/transfers';
import type { CurrencyCode, Transaction } from '@/api/types';
import type { RateTable } from '@/lib/fx';
import { usePreferences } from '@/lib/preferences';
import { monthsAgo, type TxListParams } from '../lib/filters';
import { byId, type LedgerContext } from '../lib/ledger';

const MINUTE = 60_000;
const MAX_MONTHS = 120;

/** Default GET /accounts, which already leaves archived accounts out of every picker. */
export const useAccounts = () => useQuery({ queryKey: keys.accounts.all, queryFn: getAccounts });

export const useCategories = () =>
  useQuery({ queryKey: keys.categories.all, queryFn: getCategories, staleTime: 5 * MINUTE });

export const usePeople = () => useQuery({ queryKey: keys.people.all, queryFn: getPeople });

export const useTransactionList = (params: TxListParams) =>
  useQuery({
    queryKey: keys.transactions.list(params),
    queryFn: () => getTransactions(params),
    placeholderData: keepPreviousData,
  });

export const useTransaction = (id: string | null | undefined) =>
  useQuery({
    queryKey: keys.transactions.detail(id ?? ''),
    queryFn: () => getTransaction(id!),
    enabled: !!id,
  });

/** Income, spend and net for one month from the analytics endpoint (default currency, no transfers). */
export function useMonthTotals(month: string) {
  // At least 12 so the current year shares the dashboard's cache entry.
  const months = Math.min(Math.max(monthsAgo(month) + 1, 12), MAX_MONTHS);
  const query = useQuery({
    queryKey: keys.analytics.monthly(months),
    queryFn: () => getMonthlyTotals(months),
    staleTime: 5 * MINUTE,
    enabled: monthsAgo(month) >= 0 && monthsAgo(month) < MAX_MONTHS,
  });
  const totals = query.data?.find((m) => m.month === month) ?? null;
  return { ...query, totals };
}

export const useSplitSyncStatus = (splitId: string) =>
  useQuery({
    queryKey: keys.splitSyncStatus(splitId),
    queryFn: () => getSyncStatus(splitId),
    staleTime: MINUTE,
  });

/** Accounts, categories and FX rates as the ledger needs them. Rates load only with foreign accounts. */
export function useLedgerContext(): LedgerContext & { ready: boolean } {
  const { prefs } = usePreferences();
  const base = prefs.default_currency;
  const accounts = useAccounts();
  const categories = useCategories();
  const people = usePeople();
  const foreign = (accounts.data ?? []).some((a) => String(a.currency) !== base);
  const rates = useQuery({
    queryKey: keys.exchangeRates(base),
    queryFn: () => fetchExchangeRates(base as CurrencyCode),
    staleTime: 60 * MINUTE,
    enabled: foreign,
  });
  const table: RateTable | null = rates.data?.conversion_rates
    ? { base, rates: rates.data.conversion_rates }
    : null;
  return useMemo(
    () => ({
      accounts: byId(accounts.data),
      categories: byId(categories.data),
      people: byId(people.data),
      base,
      rates: table,
      ready: accounts.data !== undefined && categories.data !== undefined,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accounts.data, categories.data, people.data, base, rates.data]
  );
}

/**
 * Existing transactions on `accountId` that could become the other leg of `tx`.
 * Without a search: opposite sign, within a day, closest amount first. With one:
 * the whole account by title or notes.
 */
export function useConvertCandidates(tx: Transaction, accountId: string, search: string) {
  const q = search.trim();
  return useQuery({
    queryKey: ['convert-candidates', tx.id, accountId, q],
    queryFn: () =>
      getConvertCandidates(tx.id, String(tx.amount), tx.date, accountId, q || undefined),
    enabled: !!accountId,
  });
}
