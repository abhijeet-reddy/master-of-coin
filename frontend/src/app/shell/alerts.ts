/**
 * Pure builders for the status strip: the fixed slot values and the rotating
 * alerts. Everything is worked out on the client from data the app already has.
 */
import { BudgetHealth as ServerHealth, type Budget, type Transaction } from '@/api/types';
import { JobStatus, JobType, type BackgroundJobSummary } from '@/api/types/jobs';
import { toNumber, type Formatters } from '@/lib/format';

export enum AlertTone {
  Crit = 'crit',
  Warn = 'warn',
  Info = 'info',
  Pos = 'pos',
}

const RANK: Record<AlertTone, number> = {
  [AlertTone.Crit]: 0,
  [AlertTone.Warn]: 1,
  [AlertTone.Info]: 2,
  [AlertTone.Pos]: 3,
};

export interface StripAlert {
  id: string;
  tone: AlertTone;
  /** Plain text before the highlighted figure. */
  lead: string;
  /** The highlighted figure or name. */
  value: string;
  tail?: string;
  href: string;
}

export interface AlertInputs {
  budgets?: Budget[];
  recent?: Transaction[];
  /** Account id to currency, for large-spend amounts. */
  currencyOf?: (accountId: string) => string | undefined;
  owedToMe?: string | number;
  lastSync?: BackgroundJobSummary | null;
  fmt: Formatters;
  /** Absolute spend (in the transaction's currency) that counts as large. */
  largeSpend?: number;
  /** Budget use (percent) that raises a warning. */
  warnAt?: number;
}

export const SYNC_JOB_TYPES: readonly JobType[] = [
  JobType.BANK_SYNC,
  JobType.PORTFOLIO_SYNC,
  JobType.BULK_SYNC,
];

export enum BudgetHealth {
  Ok = 'ok',
  Warning = 'warning',
  Over = 'over',
}

export function budgetHealth(b: Budget, warnAt = 80): BudgetHealth | null {
  const pct = b.percentage_used;
  if (pct === undefined || pct === null || !Number.isFinite(pct)) return null;
  if (b.status === ServerHealth.Over || pct > 100) return BudgetHealth.Over;
  if (pct >= warnAt) return BudgetHealth.Warning;
  return BudgetHealth.Ok;
}

export function buildAlerts(input: AlertInputs): StripAlert[] {
  const { fmt, largeSpend = 500, warnAt = 80 } = input;
  const out: StripAlert[] = [];

  if (input.lastSync?.status === JobStatus.FAILED) {
    out.push({
      id: `sync-${input.lastSync.id}`,
      tone: AlertTone.Crit,
      lead: 'Last sync failed:',
      value: jobLabel(input.lastSync.job_type),
      href: `/jobs/${input.lastSync.job_type}/${input.lastSync.id}`,
    });
  }

  for (const b of input.budgets ?? []) {
    const health = budgetHealth(b, warnAt);
    const pct = b.percentage_used ?? 0;
    if (health === BudgetHealth.Over) {
      const spent = toNumber(b.current_spending);
      const limit = toNumber(b.active_range?.limit_amount);
      const over = Number.isFinite(spent) && Number.isFinite(limit) ? spent - limit : NaN;
      out.push({
        id: `budget-${b.id}`,
        tone: AlertTone.Crit,
        lead: `${b.name} over by`,
        value: Number.isFinite(over) ? fmt.money(over) : `${Math.round(pct)}%`,
        href: `/budgets/${b.id}`,
      });
    } else if (health === BudgetHealth.Warning) {
      out.push({
        id: `budget-${b.id}`,
        tone: AlertTone.Warn,
        lead: `${b.name} at`,
        value: `${Math.round(pct)}%`,
        tail: 'of limit',
        href: `/budgets/${b.id}`,
      });
    }
  }

  for (const t of input.recent ?? []) {
    const amount = toNumber(t.amount);
    if (t.transfer_info || !Number.isFinite(amount) || amount > -largeSpend) continue;
    out.push({
      id: `tx-${t.id}`,
      tone: AlertTone.Info,
      lead: 'Large spend',
      value: `${t.title} ${fmt.money(amount, input.currencyOf?.(t.account_id))}`,
      href: `/transactions/${t.id}`,
    });
  }

  const owed = toNumber(input.owedToMe);
  if (Number.isFinite(owed) && owed > 0) {
    out.push({
      id: 'owed-to-me',
      tone: AlertTone.Pos,
      lead: 'People owe you',
      value: fmt.money(owed),
      href: '/people',
    });
  }

  return out
    .map((a, i) => ({ a, i }))
    .sort((x, y) => RANK[x.a.tone] - RANK[y.a.tone] || x.i - y.i)
    .map((x) => x.a);
}

export interface BudgetCounts {
  over: number;
  warning: number;
  total: number;
}

export function countBudgets(budgets: Budget[] | undefined, warnAt = 80): BudgetCounts {
  const counts: BudgetCounts = { over: 0, warning: 0, total: 0 };
  for (const b of budgets ?? []) {
    const h = budgetHealth(b, warnAt);
    if (h === null) continue;
    counts.total += 1;
    if (h === BudgetHealth.Over) counts.over += 1;
    else if (h === BudgetHealth.Warning) counts.warning += 1;
  }
  return counts;
}

/** The newest finished (completed or failed) sync job. */
export function latestSync(jobs: BackgroundJobSummary[] | undefined): BackgroundJobSummary | null {
  let best: BackgroundJobSummary | null = null;
  let bestAt = -Infinity;
  for (const j of jobs ?? []) {
    if (!SYNC_JOB_TYPES.includes(j.job_type)) continue;
    if (j.status !== JobStatus.COMPLETED && j.status !== JobStatus.FAILED) continue;
    const at = Date.parse(j.completed_at ?? j.created_at);
    if (Number.isFinite(at) && at > bestAt) {
      best = j;
      bestAt = at;
    }
  }
  return best;
}

export function jobLabel(type: JobType): string {
  switch (type) {
    case JobType.BANK_SYNC:
      return 'Bank sync';
    case JobType.PORTFOLIO_SYNC:
      return 'Portfolio sync';
    case JobType.BULK_SYNC:
      return 'Split sync';
    case JobType.DRIFT_DETECTION:
      return 'Drift check';
    default:
      return 'Job';
  }
}
