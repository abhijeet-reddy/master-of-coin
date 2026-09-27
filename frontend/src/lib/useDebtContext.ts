/**
 * Everything needed to total debts per currency: every split transaction, the accounts they
 * sit in and the rates into the default currency. Shared by People, the dashboard and the
 * status strip, so all three show the same converted figures from one set of queries.
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getAccountsWithArchived } from '@/api/accounts';
import { fetchExchangeRates } from '@/api/exchangeRates';
import { keys } from '@/api/keys';
import { getPeople } from '@/api/people';
import { getTransactions } from '@/api/transactions';
import type { CurrencyCode, QueryParams } from '@/api/types';
import { netsByCurrency, withBalances, type PersonWithBalance } from './debtCurrency';
import type { RateTable } from './fx';
import { usePreferences } from './preferences';

const MINUTE = 60_000;
/** The server's page cap. */
export const DEBT_TX_LIMIT = 1000;

export interface DebtContext {
  /** person id to currency to signed split total */
  nets: Map<string, Map<string, number>>;
  base: string;
  rates: RateTable | null;
  /** account id to its currency */
  currencyOf: (accountId: string) => string | undefined;
  /**
   * False until the split transactions and accounts have settled. A failed read counts as
   * settled: balances then fall back to the server's figure rather than never showing.
   */
  ready: boolean;
}

export function useDebtContext(): DebtContext {
  const { prefs } = usePreferences();
  const base = prefs.default_currency;
  const params: QueryParams = { has_splits: true, limit: DEBT_TX_LIMIT, offset: 0 };
  const txs = useQuery({
    queryKey: keys.transactions.list(params),
    queryFn: () => getTransactions(params),
  });
  const accounts = useQuery({
    queryKey: keys.accounts.withArchived,
    queryFn: getAccountsWithArchived,
  });
  const foreign = (accounts.data ?? []).some((a) => String(a.currency) !== base);
  const rates = useQuery({
    queryKey: keys.exchangeRates(base),
    queryFn: () => fetchExchangeRates(base as CurrencyCode),
    staleTime: 60 * MINUTE,
    enabled: foreign,
  });
  return useMemo(() => {
    const cur = new Map((accounts.data ?? []).map((a) => [a.id, String(a.currency)]));
    const currencyOf = (id: string) => cur.get(id);
    const table = rates.data?.conversion_rates
      ? { base, rates: rates.data.conversion_rates }
      : null;
    return {
      nets: netsByCurrency(txs.data?.data ?? [], currencyOf),
      base,
      rates: table,
      currencyOf,
      ready: (!!txs.data || txs.isError) && (!!accounts.data || accounts.isError),
    };
  }, [txs.data, txs.isError, accounts.data, accounts.isError, rates.data, base]);
}

/** The people list, each with a balance converted into the default currency. */
export function usePeopleWithBalances() {
  const people = useQuery({ queryKey: keys.people.all, queryFn: getPeople });
  const ctx = useDebtContext();
  const data = useMemo<PersonWithBalance[] | undefined>(
    () =>
      people.data && ctx.ready
        ? withBalances(people.data, ctx.nets, ctx.base, ctx.rates)
        : undefined,
    [people.data, ctx]
  );
  // Hold the skeleton until the splits are in, so a raw server sum never flashes first.
  return { ...people, data, isPending: people.isPending || (!people.isError && !ctx.ready) };
}
