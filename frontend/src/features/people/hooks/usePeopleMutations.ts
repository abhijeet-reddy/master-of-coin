/**
 * Person writes. Debts show on the dashboard and settling adds a transaction,
 * so the writes refresh those as well.
 */
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { keys } from '@/api/keys';
import {
  createPerson,
  deletePerson,
  deletePersonSplitConfig,
  setPersonSplitConfig,
  settleDebt,
  updatePerson,
} from '@/api/people';
import type { Person } from '@/api/types';
import { toast } from '@/ui';
import { buildPersonCreate, buildPersonUpdate, type PersonFormValues } from '../forms/personForm';
import { buildSettleRequest, type SettleFormValues } from '../forms/settleForm';

function refresh(qc: QueryClient, withLedger = false) {
  void qc.invalidateQueries({ queryKey: keys.people.all });
  void qc.invalidateQueries({ queryKey: keys.dashboard });
  if (withLedger) {
    void qc.invalidateQueries({ queryKey: keys.transactions.all });
    void qc.invalidateQueries({ queryKey: keys.accounts.all });
    void qc.invalidateQueries({ queryKey: keys.analytics.all });
  }
}

export function useSavePerson(before: Person | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: PersonFormValues): Promise<Person> =>
      before
        ? updatePerson(before.id, buildPersonUpdate(v, before))
        : createPerson(buildPersonCreate(v)),
    onSuccess: (saved) => {
      refresh(qc, !!before);
      toast.success(before ? 'Person saved' : 'Person added', { description: saved.name });
    },
  });
}

export function useDeletePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: Person) => deletePerson(p.id),
    onSuccess: (_v, p) => {
      qc.removeQueries({ queryKey: keys.people.detail(p.id) });
      refresh(qc);
      toast.success('Person deleted', { description: p.name });
    },
  });
}

export function useSettle(person: Person) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: SettleFormValues) => settleDebt(person.id, buildSettleRequest(v)),
    onSuccess: () => {
      refresh(qc, true);
      toast.success('Debt settled', { description: person.name });
    },
  });
}

export function useLinkSplit(person: Person) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { split_provider_id: string; external_user_id: string }) =>
      setPersonSplitConfig(person.id, v),
    onSuccess: (config) => {
      qc.setQueryData(keys.people.splitConfig(person.id), config);
      void qc.invalidateQueries({ queryKey: keys.people.all });
      toast.success('Split provider linked', { description: person.name });
    },
  });
}

export function useUnlinkSplit(person: Person) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => deletePersonSplitConfig(person.id),
    onSuccess: () => {
      qc.setQueryData(keys.people.splitConfig(person.id), null);
      void qc.invalidateQueries({ queryKey: keys.people.all });
      toast.success('Split provider unlinked', { description: person.name });
    },
  });
}
