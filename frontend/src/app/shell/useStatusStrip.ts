import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAccounts } from '@/api/accounts';
import { getMonthlyTotals } from '@/api/analytics';
import { getBudgets } from '@/api/budgets';
import { getDashboardSummary } from '@/api/dashboard';
import { listJobs } from '@/api/jobs';
import { keys } from '@/api/keys';
import { toNumber } from '@/lib/format';
import { debtTotals } from '@/lib/debtCurrency';
import { usePreferences } from '@/lib/preferences';
import { usePeopleWithBalances } from '@/lib/useDebtContext';
import {
  buildAlerts,
  countBudgets,
  latestSync,
  type BudgetCounts,
  type StripAlert,
} from './alerts';
import type { BackgroundJobSummary } from '@/api/types/jobs';

export interface StatusStripData {
  netWorth: number | null;
  monthLabel: string;
  monthNet: number | null;
  budgets: BudgetCounts | null;
  lastSync: BackgroundJobSummary | null;
  syncLoaded: boolean;
  alerts: StripAlert[];
}

const JOB_PARAMS = { limit: 20 };
const MINUTE = 60_000;

/** Everything the status strip shows. Each slot degrades to "--" on its own if its query fails. */
export function useStatusStrip(): StatusStripData {
  const { fmt } = usePreferences();
  const dashboard = useQuery({
    queryKey: keys.dashboard,
    queryFn: getDashboardSummary,
    staleTime: MINUTE,
  });
  const budgets = useQuery({
    queryKey: keys.budgets.list(),
    queryFn: () => getBudgets(),
    staleTime: MINUTE,
  });
  const monthly = useQuery({
    queryKey: keys.analytics.monthly(1),
    queryFn: () => getMonthlyTotals(1),
    staleTime: MINUTE,
  });
  const jobs = useQuery({
    queryKey: keys.jobs.list(JOB_PARAMS),
    queryFn: () => listJobs(JOB_PARAMS),
    staleTime: MINUTE,
    refetchInterval: 5 * MINUTE,
  });
  const accounts = useQuery({ queryKey: keys.accounts.all, queryFn: getAccounts });
  // Converted per split; the dashboard's debt_overview adds currencies together raw.
  const people = usePeopleWithBalances();

  return useMemo(() => {
    const month = monthly.data?.[monthly.data.length - 1];
    const lastSync = latestSync(jobs.data);
    const currency = new Map((accounts.data ?? []).map((a) => [a.id, a.currency] as const));
    const nw = toNumber(dashboard.data?.net_worth);
    const net = toNumber(month?.net);
    return {
      netWorth: Number.isFinite(nw) ? nw : null,
      monthLabel: month ? monthName(month.month) : monthName(null),
      monthNet: Number.isFinite(net) ? net : null,
      budgets: budgets.data ? countBudgets(budgets.data) : null,
      lastSync,
      syncLoaded: jobs.isSuccess,
      alerts: buildAlerts({
        budgets: budgets.data,
        recent: dashboard.data?.recent_transactions,
        currencyOf: (id) => currency.get(id),
        owedToMe: people.data ? debtTotals(people.data.map((p) => p.balance)).owedToMe : undefined,
        lastSync,
        fmt,
      }),
    };
  }, [
    dashboard.data,
    budgets.data,
    monthly.data,
    jobs.data,
    jobs.isSuccess,
    accounts.data,
    people.data,
    fmt,
  ]);
}

function monthName(ym: string | null): string {
  const d = ym ? new Date(`${ym}-01T00:00:00`) : new Date();
  return Number.isNaN(d.getTime()) ? 'Month' : d.toLocaleString('en', { month: 'short' });
}
