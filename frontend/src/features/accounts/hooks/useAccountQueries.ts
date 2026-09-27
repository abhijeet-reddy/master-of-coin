/** Every query the accounts pages read. Keys come from api/keys so invalidation reaches the dashboard too. */
import { useQuery } from '@tanstack/react-query';
import { getAccount, getAccountsWithArchived } from '@/api/accounts';
import { getBalance, listBankProviders, listExternalAccounts } from '@/api/bankProviders';
import { fetchExchangeRates } from '@/api/exchangeRates';
import { getPortfolioSyncJob, listProviders } from '@/api/investmentProviders';
import { listJobs } from '@/api/jobs';
import { keys } from '@/api/keys';
import { getTransactions } from '@/api/transactions';
import { JobStatus, JobType, type Account, type CurrencyCode } from '@/api/types';
import type { RateTable } from '@/lib/fx';
import { usePreferences } from '@/lib/preferences';

const MINUTE = 60_000;
/** How far back the balance history goes. */
export const HISTORY_DAYS = 90;
/** The server's page cap; more rows than this trims the start of the history. */
const HISTORY_LIMIT = 1000;

export const useAllAccounts = () =>
  useQuery({ queryKey: keys.accounts.withArchived, queryFn: getAccountsWithArchived });

export const useAccount = (id: string) =>
  useQuery({ queryKey: keys.accounts.detail(id), queryFn: () => getAccount(id), enabled: !!id });

export const useBankProviders = () =>
  useQuery({ queryKey: keys.bankProviders, queryFn: listBankProviders });

export const useInvestmentProviders = () =>
  useQuery({ queryKey: keys.investmentProviders, queryFn: listProviders });

/** Rates into the user's currency; only fetched when some account is in another currency. */
export function useRateTable(accounts: readonly Account[] | undefined) {
  const { prefs } = usePreferences();
  const base = prefs.default_currency;
  const foreign = (accounts ?? []).some((a) => String(a.currency) !== base);
  const q = useQuery({
    queryKey: keys.exchangeRates(base),
    queryFn: () => fetchExchangeRates(base as CurrencyCode),
    staleTime: 60 * MINUTE,
    enabled: foreign,
  });
  const table: RateTable | null = q.data?.conversion_rates
    ? { base, rates: q.data.conversion_rates }
    : null;
  return { base, table, foreign, query: q, ready: !foreign || q.data !== undefined || q.isError };
}

/** Start of the history window, local midnight `HISTORY_DAYS` ago. */
export function historyStart(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - HISTORY_DAYS);
}

/** Every transaction on the account in the history window (newest first, capped by the server). */
export function useHistoryTransactions(accountId: string) {
  const start = historyStart().toISOString();
  const params = { account_id: accountId, start_date: start, limit: HISTORY_LIMIT, offset: 0 };
  return useQuery({
    queryKey: keys.transactions.list({ ...params, start_date: start.slice(0, 10) }),
    queryFn: () => getTransactions(params),
    enabled: !!accountId,
  });
}

export const useBankBalance = (providerId: string | null) =>
  useQuery({
    queryKey: [...keys.bankProviders, providerId, 'balance'],
    queryFn: () => getBalance(providerId ?? ''),
    enabled: !!providerId,
    staleTime: 5 * MINUTE,
    retry: 1,
  });

export const useExternalAccounts = (providerId: string | null, enabled: boolean) =>
  useQuery({
    queryKey: [...keys.bankProviders, providerId, 'external-accounts'],
    queryFn: () => listExternalAccounts(providerId ?? ''),
    enabled: !!providerId && enabled,
  });

/**
 * The newest finished portfolio sync that reported on this account. Looks at the
 * last few PORTFOLIO_SYNC jobs; null when none of them covered it.
 */
export function useLatestPortfolioSync(accountId: string, enabled: boolean) {
  return useQuery({
    queryKey: [
      ...keys.jobs.list({ job_type: JobType.PORTFOLIO_SYNC, limit: 10 }),
      'account',
      accountId,
    ],
    enabled,
    queryFn: async () => {
      const jobs = await listJobs({ job_type: JobType.PORTFOLIO_SYNC, limit: 10 });
      const done = jobs
        .filter((j) => j.status === JobStatus.COMPLETED)
        .sort((a, b) =>
          (b.completed_at ?? b.created_at).localeCompare(a.completed_at ?? a.created_at)
        );
      for (const j of done.slice(0, 3)) {
        const detail = await getPortfolioSyncJob(j.id);
        if (detail.result?.synced_accounts.some((s) => s.account_id === accountId)) return detail;
      }
      return null;
    },
  });
}
