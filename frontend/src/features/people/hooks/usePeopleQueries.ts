/** Every read the people feature makes. Keys come from `api/keys`. */
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getAccounts } from '@/api/accounts';
import { getProviderFriends, listProviders } from '@/api/integrations';
import { keys } from '@/api/keys';
import { getPeople, getPerson, getPersonSplitConfig } from '@/api/people';
import { getTransactions } from '@/api/transactions';
import type { Person, QueryParams } from '@/api/types';
import { balanceOf, type PersonWithBalance } from '@/lib/debtCurrency';
import { useDebtContext } from '@/lib/useDebtContext';

export { usePeopleWithBalances } from '@/lib/useDebtContext';

const MINUTE = 60_000;
/** The server's page cap. */
const TX_LIMIT = 1000;

export const usePeople = () => useQuery({ queryKey: keys.people.all, queryFn: getPeople });

export const usePerson = (id: string) =>
  useQuery({ queryKey: keys.people.detail(id), queryFn: () => getPerson(id), enabled: !!id });

/** null when the person is not linked to a split provider. */
export const useSplitConfig = (id: string) =>
  useQuery({
    queryKey: keys.people.splitConfig(id),
    queryFn: () => getPersonSplitConfig(id),
    enabled: !!id,
  });

/** Connected providers; the link dialog offers the active ones only. */
export const useSplitProviders = () =>
  useQuery({
    queryKey: [...keys.integrations, 'providers'],
    queryFn: listProviders,
    staleTime: 5 * MINUTE,
  });

export const useProviderFriends = (providerId: string) =>
  useQuery({
    queryKey: [...keys.integrations, 'providers', providerId, 'friends'],
    queryFn: () => getProviderFriends(providerId),
    enabled: !!providerId,
    staleTime: 5 * MINUTE,
  });

/** GET /accounts leaves archived accounts out, which is what a picker wants. */
export const useActiveAccounts = () =>
  useQuery({ queryKey: keys.accounts.all, queryFn: getAccounts });

/** Every transaction shared with the person, for the debt history. */
export function usePersonHistory(id: string) {
  const params: QueryParams = { person_id: id, limit: TX_LIMIT, offset: 0 };
  const query = useQuery({
    queryKey: keys.transactions.list(params),
    queryFn: () => getTransactions(params),
    enabled: !!id,
  });
  const truncated = !!query.data && query.data.pagination.total > query.data.data.length;
  return { query, truncated };
}

/** One person with a converted balance. */
export function usePersonWithBalance(id: string) {
  const person = usePerson(id);
  const ctx = useDebtContext();
  const data = useMemo<PersonWithBalance | undefined>(() => {
    const p: Person | undefined = person.data;
    if (!p) return undefined;
    return {
      ...p,
      balance: balanceOf(p.debt_summary?.net, ctx.nets.get(p.id), ctx.base, ctx.rates),
    };
  }, [person.data, ctx]);
  return { ...person, data, ctx };
}
