/** Split providers (Splitwise, SplitPro), drift detection, and bank or brokerage links. */
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { disconnectProvider as disconnectBank } from '@/api/bankProviders';
import { toApiError } from '@/api/client';
import { startDriftDetection } from '@/api/drift';
import {
  connectSplitPro,
  disconnectProvider as disconnectSplit,
  getSplitwiseAuthUrl,
} from '@/api/integrations';
import { disconnectProvider as disconnectBroker } from '@/api/investmentProviders';
import { keys } from '@/api/keys';
import type { SplitProvider } from '@/api/types';
import { ProviderKind, type ProviderLink } from '@/features/dashboard/lib/dashboardModel';
import { toast } from '@/ui';
import {
  driftDefaults,
  driftSchema,
  splitProSchema,
  type DriftValues,
  type SplitProValues,
} from '../forms/integrationForms';

const SPLIT_KEY = [...keys.integrations, 'providers'];

const fail = (title: string) => (err: unknown) =>
  toast.error(title, { description: toApiError(err).message });

/** Hands the browser to Splitwise; it comes back to `/settings?tab=split&status=...`. */
export function useConnectSplitwise() {
  return useMutation({
    mutationFn: getSplitwiseAuthUrl,
    onSuccess: ({ auth_url }) => window.location.assign(auth_url),
    onError: fail("Couldn't start the Splitwise connection"),
  });
}

export function useDisconnectSplit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: SplitProvider) => disconnectSplit(p.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.integrations });
      void qc.invalidateQueries({ queryKey: keys.people.all });
      toast.success('Provider disconnected');
    },
    onError: fail("Couldn't disconnect the provider"),
  });
}

export function useSplitProForm(onDone: () => void) {
  const qc = useQueryClient();
  const form = useForm<SplitProValues>({
    resolver: zodResolver(splitProSchema),
    defaultValues: { email: '' },
  });
  const save = useMutation({
    mutationFn: (v: SplitProValues) => connectSplitPro({ email: v.email.trim() }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: SPLIT_KEY });
      toast.success('SplitPro connected');
    },
  });
  const submit = form.handleSubmit(async (v) => {
    try {
      await save.mutateAsync(v);
      form.reset({ email: '' });
      onDone();
    } catch (err) {
      form.setError('root', { message: toApiError(err).message });
    }
  });
  return { form, submit, saving: save.isPending };
}

/** Starts a drift detection job and opens its page. */
export function useDriftForm() {
  const navigate = useNavigate();
  const form = useForm<DriftValues>({
    resolver: zodResolver(driftSchema),
    defaultValues: driftDefaults(new Date()),
  });
  const start = useMutation({ mutationFn: startDriftDetection });
  const submit = form.handleSubmit(async (v) => {
    try {
      const { job_id } = await start.mutateAsync(v);
      toast.success('Drift detection started');
      void navigate(`/jobs/drift-detection/${job_id}`);
    } catch (err) {
      form.setError('root', { message: toApiError(err).message });
    }
  });
  return { form, submit, saving: start.isPending };
}

export function useDisconnectLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (l: ProviderLink) =>
      l.kind === ProviderKind.Bank ? disconnectBank(l.id) : disconnectBroker(l.id),
    onSuccess: (_v, l) => {
      void qc.invalidateQueries({
        queryKey: l.kind === ProviderKind.Bank ? keys.bankProviders : keys.investmentProviders,
      });
      toast.success(`${l.providerName} disconnected`, { description: l.accountName });
    },
    onError: fail("Couldn't disconnect the provider"),
  });
}
