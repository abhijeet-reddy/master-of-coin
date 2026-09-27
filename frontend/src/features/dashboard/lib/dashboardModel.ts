/**
 * Pure derivations behind the dashboard panels. No React, no fetching: every
 * function takes API shapes and returns what a panel renders.
 */
import { foldSlices, type Slice } from '@/charts/foldSlices';
import { toDate, toNumber } from '@/lib/format';
import { Tone } from '@/ui/types';
import { TYPE_ORDER, typeMeta } from '@/lib/accountTypes';
import {
  AccountType,
  BudgetHealth,
  type Account,
  type Category,
  type CategoryBreakdownItem,
  type DashboardBudgetStatus,
  type Person,
  type Transaction,
} from '@/api/types';
import { splitPersonName } from '@/features/transactions/lib/ledger';
import type { MonthlyTotals, NetWorthPoint } from '@/api/types/analytics';
import type { PersonWithBalance } from '@/lib/debtCurrency';

const num = (v: string | number | null | undefined) => {
  const n = toNumber(v);
  return Number.isFinite(n) ? n : 0;
};

/* ---------------------------------------------------------------- balance sheet */

export interface BalanceRow {
  type: string;
  label: string;
  tag: string;
  /** Liability types, or any type whose total is negative. */
  liability: boolean;
  total: number;
  count: number;
}

export interface BalanceSheet {
  rows: BalanceRow[];
  assets: number;
  /** Negative (or zero). */
  liabilities: number;
  net: number;
  /** Share of gross (assets + |liabilities|) held as assets, 0..1. */
  assetShare: number;
}

/**
 * Per-type totals come from the latest net-worth point (already in the user's
 * currency); counts come from the account list. Types with no accounts and a
 * zero total are dropped. Assets first, then liabilities, each in a fixed order.
 */
export function balanceSheet(
  byType: Record<string, string> | undefined,
  accounts: readonly Account[]
): BalanceSheet {
  const counts = new Map<string, number>();
  for (const a of accounts) counts.set(a.account_type, (counts.get(a.account_type) ?? 0) + 1);
  const types = new Set<string>([...Object.keys(byType ?? {}), ...counts.keys()]);
  const rank = (t: string) => {
    const i = TYPE_ORDER.indexOf(t as AccountType);
    return i === -1 ? TYPE_ORDER.length : i;
  };
  const rows: BalanceRow[] = [...types]
    .map((type) => {
      const meta = typeMeta(type);
      const total = num(byType?.[type]);
      return {
        type,
        label: meta.label,
        tag: meta.tag,
        liability: meta.liability || total < 0,
        total,
        count: counts.get(type) ?? 0,
      };
    })
    .filter((r) => r.count > 0 || r.total !== 0)
    .sort((a, b) => Number(a.liability) - Number(b.liability) || rank(a.type) - rank(b.type));
  const assets = rows.reduce((s, r) => s + (r.total > 0 ? r.total : 0), 0);
  const liabilities = rows.reduce((s, r) => s + (r.total < 0 ? r.total : 0), 0);
  const gross = assets - liabilities;
  return {
    rows,
    assets,
    liabilities,
    net: assets + liabilities,
    assetShare: gross > 0 ? assets / gross : 0,
  };
}

/* ---------------------------------------------------------------- net worth */

export interface NetWorthDelta {
  change: number;
  /** Percent change against the first point; null when it started at zero. */
  percent: number | null;
  /** Date of the first point. */
  since: string;
}

/** Change across the whole history: first point against the latest. */
export function netWorthDelta(points: readonly NetWorthPoint[]): NetWorthDelta | null {
  if (points.length < 2) return null;
  const first = num(points[0].total);
  const last = num(points[points.length - 1].total);
  const change = last - first;
  return {
    change,
    percent: first === 0 ? null : (change / Math.abs(first)) * 100,
    since: points[0].date,
  };
}

/* ---------------------------------------------------------------- income vs spend */

/** `YYYY-MM` read as the first of that month, local time. */
export function monthDate(month: string): Date | null {
  return toDate(`${month}-01`);
}

export interface MonthlyStats {
  current: { month: string; income: number; spend: number; net: number } | null;
  /** Mean spend across every month in the series. */
  avgSpend: number | null;
  /** (income - spend) / income for the current month, as a percentage. Null without income. */
  savingsRate: number | null;
  months: string[];
  income: number[];
  spend: number[];
}

/** The series is oldest first and its last entry is the current month. */
export function monthlyStats(series: readonly MonthlyTotals[]): MonthlyStats {
  const income = series.map((m) => num(m.income));
  const spend = series.map((m) => num(m.spend));
  const last = series.length - 1;
  const current =
    last >= 0
      ? {
          month: series[last].month,
          income: income[last],
          spend: spend[last],
          net: num(series[last].net),
        }
      : null;
  return {
    current,
    avgSpend: spend.length ? spend.reduce((s, v) => s + v, 0) / spend.length : null,
    savingsRate:
      current && current.income > 0
        ? ((current.income - current.spend) / current.income) * 100
        : null,
    months: series.map((m) => m.month),
    income,
    spend,
  };
}

/** True when every month has neither income nor spend. */
export function isQuietSeries(stats: MonthlyStats): boolean {
  return stats.income.every((v) => v === 0) && stats.spend.every((v) => v === 0);
}

/* ---------------------------------------------------------------- budgets */

const DAY = 864e5;

/** Percent of an inclusive `YYYY-MM-DD` period that has elapsed by the end of `today`. */
export function periodElapsed(start: string, end: string, today: Date): number | null {
  const s = toDate(start);
  const e = toDate(end);
  if (!s || !e) return null;
  const total = Math.round((e.getTime() - s.getTime()) / DAY) + 1;
  if (total <= 0) return null;
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const done = Math.round((t.getTime() - s.getTime()) / DAY) + 1;
  return Math.max(0, Math.min(100, (done / total) * 100));
}

export function healthLabel(h: BudgetHealth): string {
  if (h === BudgetHealth.Over) return 'Exceeded';
  if (h === BudgetHealth.Warning) return 'Warning';
  return 'OK';
}

export function healthTone(h: BudgetHealth): Tone {
  if (h === BudgetHealth.Over) return Tone.Crit;
  if (h === BudgetHealth.Warning) return Tone.Warn;
  return Tone.Pos;
}

export interface BudgetRow {
  id: string;
  name: string;
  percent: number;
  pace: number | null;
  health: BudgetHealth;
  spent: string;
  limit: string;
  currency: string;
  daysLeft: number;
}

/** Most-used budgets first. */
export function budgetRows(
  statuses: readonly DashboardBudgetStatus[],
  today: Date,
  limit = 4
): BudgetRow[] {
  return [...statuses]
    .sort((a, b) => b.percentage_used - a.percentage_used)
    .slice(0, limit)
    .map((s) => ({
      id: s.budget_id,
      name: s.name,
      percent: s.percentage_used,
      pace: periodElapsed(s.period_start, s.period_end, today),
      health: s.status,
      spent: s.current_spending,
      limit: s.limit_amount,
      currency: s.currency,
      daysLeft: s.days_left,
    }));
}

/* ---------------------------------------------------------------- categories */

export const UNCATEGORISED = 'Uncategorised';

export interface CategoryShare {
  slices: Slice[];
  total: number;
}

export function categoryShares(items: readonly CategoryBreakdownItem[], max = 7): CategoryShare {
  const slices = foldSlices(
    items.map((c) => ({
      key: c.category_id ?? '__none',
      label: c.category_name ?? UNCATEGORISED,
      value: num(c.total),
    })),
    max
  );
  return { slices, total: slices.reduce((s, x) => s + x.value, 0) };
}

export interface RankRow {
  key: string;
  label: string;
  value: number;
  /** Bar length relative to the largest row, 0..1. */
  width: number;
  /** Share of all spend, as a percentage. */
  percent: number;
}

/** Biggest categories, bar lengths scaled to the top one. */
export function topSpend(items: readonly CategoryBreakdownItem[], limit = 5): RankRow[] {
  const rows = items
    .map((c) => ({
      key: c.category_id ?? '__none',
      label: c.category_name ?? UNCATEGORISED,
      value: num(c.total),
      percent: c.percentage,
    }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
  const max = rows[0]?.value ?? 0;
  return rows.map((r) => ({ ...r, width: max > 0 ? r.value / max : 0 }));
}

/* ---------------------------------------------------------------- debts */

export interface DebtRow {
  id: string;
  name: string;
  /** Positive: they owe you. Negative: you owe them. */
  net: number;
  /** |net| relative to the largest balance, 0..1. */
  width: number;
}

/**
 * People with an open balance, largest first. Uses the balance converted into the default
 * currency; the server's `debt_summary.net` adds split amounts across currencies raw, so it
 * is only a fallback for a person with no converted balance.
 */
export function debtRows(people: readonly PersonWithBalance[], limit = 5): DebtRow[] {
  const rows = people
    .map((p) => ({ id: p.id, name: p.name, net: p.balance?.net ?? num(p.debt_summary?.net) }))
    .filter((r) => Math.abs(r.net) >= 0.005)
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
    .slice(0, limit);
  const max = Math.abs(rows[0]?.net ?? 0);
  return rows.map((r) => ({ ...r, width: max > 0 ? Math.abs(r.net) / max : 0 }));
}

/* ---------------------------------------------------------------- providers */

export enum ProviderKind {
  Bank = 'bank',
  Investment = 'investment',
}

export interface ProviderLink {
  id: string;
  kind: ProviderKind;
  accountId: string;
  accountName: string;
  providerName: string;
  lastSyncAt: string | null;
}

export interface ProviderInput {
  id: string;
  account_id: string;
  is_active: boolean;
  last_sync_at?: string | null;
}

/** Active provider links joined with their account names; accounts that no longer exist are skipped. */
export function providerLinks(
  banks: readonly ProviderInput[],
  investments: readonly ProviderInput[],
  accounts: readonly Account[],
  names: { bank: string; investment: string }
): ProviderLink[] {
  const byId = new Map(accounts.map((a) => [a.id, a.name] as const));
  const build = (list: readonly ProviderInput[], kind: ProviderKind, providerName: string) =>
    list
      .filter((p) => p.is_active && byId.has(p.account_id))
      .map((p) => ({
        id: p.id,
        kind,
        accountId: p.account_id,
        accountName: byId.get(p.account_id) ?? '',
        providerName,
        lastSyncAt: p.last_sync_at ?? null,
      }));
  return [
    ...build(banks, ProviderKind.Bank, names.bank),
    ...build(investments, ProviderKind.Investment, names.investment),
  ];
}

/** Foreign currencies held, each with the rate to the base (1 unit of X in base). */
export function fxPairs(
  accounts: readonly Account[],
  base: string,
  rates: Record<string, number> | undefined
) {
  const codes = [...new Set(accounts.map((a) => String(a.currency)))]
    .filter((c) => c !== base)
    .sort();
  return codes.map((code) => {
    const r = rates?.[code];
    return { code, rate: r && Number.isFinite(r) && r > 0 ? 1 / r : null };
  });
}

/* ---------------------------------------------------------------- recent activity */

export interface ActivityRow {
  id: string;
  date: string;
  title: string;
  amount: string;
  currency: string;
  accountName: string;
  categoryName: string | null;
  categoryColor: string | null;
  /** First split person's name and how many splits there are. */
  split: { name: string; count: number } | null;
  transferTo: string | null;
  hasNote: boolean;
}

/** Transactions joined with their account and category, for the recent activity table. */
export function activityRows(
  transactions: readonly Transaction[],
  accounts: readonly Account[],
  categories: readonly Category[],
  people?: ReadonlyMap<string, Pick<Person, 'name'>>
): ActivityRow[] {
  const acc = new Map(accounts.map((a) => [a.id, a] as const));
  const cat = new Map(categories.map((c) => [c.id, c] as const));
  return transactions.map((t) => {
    const a = acc.get(t.account_id);
    const c = t.category_id ? cat.get(t.category_id) : undefined;
    const splits = t.splits ?? [];
    return {
      id: t.id,
      date: t.date,
      title: t.title,
      amount: t.amount,
      currency: a?.currency ?? '',
      accountName: a?.name ?? 'Unknown account',
      categoryName: t.transfer_info ? 'Transfer' : (c?.name ?? null),
      categoryColor: c?.color || null,
      split: splits.length
        ? { name: splitPersonName(splits[0], people), count: splits.length }
        : null,
      transferTo: t.transfer_info?.linked_account_name ?? null,
      hasNote: Boolean(t.notes?.trim()),
    };
  });
}
