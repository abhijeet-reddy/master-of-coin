/**
 * Account writes. Every write refreshes whatever reads account balances:
 * the accounts pages, the dashboard, analytics and the ledgers.
 */
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  archiveAccount,
  createAccount,
  deleteAccount,
  unarchiveAccount,
  updateAccount,
  updateAccountBalance,
} from '@/api/accounts';
import {
  disconnectProvider as disconnectBank,
  getAuthUrl,
  linkExternalAccount,
  startSync,
} from '@/api/bankProviders';
import { toApiError } from '@/api/client';
import {
  connectProvider,
  disconnectProvider as disconnectBroker,
  getPortfolioSyncJob,
  startPortfolioSync,
} from '@/api/investmentProviders';
import { keys } from '@/api/keys';
import { AccountType, InvestmentProviderType, JobStatus, type Account } from '@/api/types';
import { toast } from '@/ui';
import {
  buildConnectRequest,
  buildCreateRequest,
  buildUpdateRequest,
  type AccountFormValues,
  type BrokerFormValues,
} from '../forms/accountForm';
import { rememberBankConnect } from '../lib/bankConnect';

const ACCOUNT_ROOTS = [
  keys.accounts.all,
  keys.dashboard,
  keys.analytics.all,
  keys.transactions.all,
];

function refreshAccounts(qc: QueryClient, extra: readonly (readonly unknown[])[] = []) {
  for (const k of [...ACCOUNT_ROOTS, ...extra]) void qc.invalidateQueries({ queryKey: k });
}

const fail = (title: string) => (err: unknown) =>
  toast.error(title, { description: toApiError(err).message });

/** Create (then optionally connect Trading 212) or edit. Resolves to the saved account. */
export function useSaveAccount(before: Account | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: AccountFormValues) => {
      if (before) {
        const patch = buildUpdateRequest(v, before);
        const saved = Object.keys(patch).length ? await updateAccount(before.id, patch) : before;
        return { saved, connectError: null as string | null };
      }
      const saved = await createAccount(buildCreateRequest(v));
      const connect = buildConnectRequest(v, saved.id);
      let connectError: string | null = null;
      if (connect) {
        try {
          await connectProvider(connect);
        } catch (err) {
          connectError = toApiError(err).message;
        }
      }
      return { saved, connectError };
    },
    onSuccess: ({ saved, connectError }) => {
      refreshAccounts(qc, [keys.investmentProviders]);
      toast.success(before ? 'Account saved' : 'Account created', { description: saved.name });
      if (connectError)
        toast.error("Couldn't connect Trading 212", {
          description: `${connectError} Connect it from the account page.`,
        });
    },
  });
}

/** Archive or unarchive; the toast offers the reverse. */
export function useArchiveAccount() {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: ({ account, archive }: { account: Account; archive: boolean }) =>
      archive ? archiveAccount(account.id) : unarchiveAccount(account.id),
    onSuccess: (_saved, { account, archive }) => {
      refreshAccounts(qc);
      toast.success(archive ? 'Account archived' : 'Account restored', {
        description: account.name,
        action: {
          label: 'Undo',
          onClick: () =>
            m.mutate({ account, archive: !archive }, { onError: fail("Couldn't undo") }),
        },
      });
    },
  });
  return m;
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (account: Account) => deleteAccount(account.id),
    onSuccess: (_v, account) => {
      qc.removeQueries({ queryKey: keys.accounts.detail(account.id) });
      refreshAccounts(qc, [keys.bankProviders, keys.investmentProviders]);
      toast.success('Account deleted', { description: account.name });
    },
  });
}

/** Investment accounts: set today's value; the server books the difference. */
export function useSetBalance(account: Account) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (balance: number) => updateAccountBalance(account.id, balance),
    onSuccess: () => {
      refreshAccounts(qc);
      toast.success('Value updated', { description: account.name });
    },
  });
}

/** Queue a bank sync and open its review page. */
export function useSyncBank(account: Account, providerId: string | null) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => startSync(providerId ?? '', {}),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: keys.jobs.all });
      toast.info('Bank sync started', { description: `Fetching ${account.name} from the bank.` });
      void navigate(`/jobs/bank-sync/${res.job_id}`);
    },
    onError: fail(`Couldn't sync ${account.name}`),
  });
}

const POLL_MS = 2000;
const isRunning = (s: string | undefined) =>
  s === String(JobStatus.PENDING) || s === String(JobStatus.RUNNING);

/** Queue a portfolio sync and watch it until it finishes. */
export function useSyncPortfolio(account: Account) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [jobId, setJobId] = useState<string | null>(null);
  const start = useMutation({
    mutationFn: () => startPortfolioSync({ account_id: account.id }),
    onSuccess: (res) => {
      setJobId(res.job_id);
      void qc.invalidateQueries({ queryKey: keys.jobs.all });
      toast.info('Portfolio sync started', {
        description: `Fetching ${account.name} from Trading 212.`,
      });
    },
    onError: fail(`Couldn't sync ${account.name}`),
  });
  const job = useQuery({
    queryKey: jobId ? keys.jobs.detail(jobId) : ['jobs', 'detail', 'none'],
    queryFn: () => getPortfolioSyncJob(jobId ?? ''),
    enabled: !!jobId,
    refetchInterval: (q) => (isRunning(q.state.data?.status) || !q.state.data ? POLL_MS : false),
  });
  const status = job.data?.status;
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!jobId || !status || isRunning(status) || handled.current === jobId) return;
    handled.current = jobId;
    refreshAccounts(qc, [keys.jobs.all]);
    if (status === String(JobStatus.COMPLETED)) {
      toast.success('Portfolio synced', { description: `${account.name} is up to date.` });
    } else {
      const id = jobId;
      toast.error('Portfolio sync failed', {
        description: job.data?.error ?? undefined,
        action: { label: 'View job', onClick: () => void navigate(`/jobs/portfolio-sync/${id}`) },
      });
    }
  }, [jobId, status, qc, account.name, job.data?.error, navigate]);
  return {
    start: () => start.mutate(),
    syncing: start.isPending || (!!jobId && (isRunning(status) || !status)),
  };
}

/** Send the user to TrueLayer; they come back through /settings?bank_connected=true. */
export function useConnectBank() {
  return useMutation({
    mutationFn: (accountId: string) => getAuthUrl(accountId),
    onSuccess: ({ auth_url }, accountId) => {
      rememberBankConnect(accountId);
      window.location.assign(auth_url);
    },
    onError: fail("Couldn't start the bank connection"),
  });
}

export function useLinkBankAccount(providerId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (externalId: string) => linkExternalAccount(providerId ?? '', externalId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.bankProviders });
      toast.success('Bank account linked', { description: 'You can sync it now.' });
    },
    onError: fail("Couldn't link the bank account"),
  });
}

export function useConnectBroker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ account, values }: { account: Account; values: BrokerFormValues }) =>
      connectProvider({
        account_id: account.id,
        provider_type: InvestmentProviderType.TRADING_212,
        api_key: values.api_key.trim(),
        api_secret: values.api_secret.trim(),
        environment: values.environment,
      }),
    onSuccess: (_p, { account }) => {
      void qc.invalidateQueries({ queryKey: keys.investmentProviders });
      toast.success('Trading 212 connected', { description: account.name });
    },
  });
}

/** Disconnect whichever provider the account has. */
export function useDisconnect(account: Account) {
  const qc = useQueryClient();
  const investment = account.account_type === AccountType.INVESTMENT;
  return useMutation({
    mutationFn: (providerId: string) =>
      investment ? disconnectBroker(providerId) : disconnectBank(providerId),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: investment ? keys.investmentProviders : keys.bankProviders,
      });
      toast.success('Provider disconnected', { description: account.name });
    },
  });
}
