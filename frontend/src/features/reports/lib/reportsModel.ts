/**
 * Derivations behind the report tabs. Every input is a server aggregate already in the
 * user's default currency (or, for budgets, in each budget's own currency); nothing here
 * adds amounts across currencies.
 */
import { DateStyle, SignDisplay, toNumber, type Formatters } from '@/lib/format';
import type { MonthlyTotals, NetWorthPoint, SpendingTrendDay } from '@/api/types/analytics';
import { BudgetHealth } from '@/api/types';
import {
  balanceSheet,
  monthDate,
  type BalanceSheet,
  type BudgetRow,
} from '@/features/dashboard/lib/dashboardModel';

const num = (v: string | number | null | undefined) => {
  const n = toNumber(v);
  return Number.isFinite(n) ? n : 0;
};

/* ---------------------------------------------------------------- cash flow */

export interface MonthNet {
  month: string;
  net: number;
}

export interface CashflowTotals {
  months: number;
  income: number;
  spend: number;
  net: number;
  /** Share of income kept, as a percentage. Null without income. */
  savingsRate: number | null;
  avgIncome: number;
  avgSpend: number;
  /** Month with the highest net, and the lowest. Null for an empty series. */
  best: MonthNet | null;
  worst: MonthNet | null;
}

export function cashflowTotals(series: readonly MonthlyTotals[]): CashflowTotals {
  const rows = series.map((m) => ({
    month: m.month,
    income: num(m.income),
    spend: num(m.spend),
    net: num(m.net),
  }));
  const income = rows.reduce((s, r) => s + r.income, 0);
  const spend = rows.reduce((s, r) => s + r.spend, 0);
  const n = rows.length;
  let best: MonthNet | null = null;
  let worst: MonthNet | null = null;
  for (const r of rows) {
    if (!best || r.net > best.net) best = { month: r.month, net: r.net };
    if (!worst || r.net < worst.net) worst = { month: r.month, net: r.net };
  }
  return {
    months: n,
    income,
    spend,
    net: income - spend,
    savingsRate: income > 0 ? ((income - spend) / income) * 100 : null,
    avgIncome: n ? income / n : 0,
    avgSpend: n ? spend / n : 0,
    best,
    worst,
  };
}

/** True when nothing came in or went out. */
export const isQuiet = (t: CashflowTotals) => t.income === 0 && t.spend === 0;

const monthName = (m: string, fmt: Formatters) => fmt.date(monthDate(m), DateStyle.MonthYear);

/** The visible one-paragraph reading of the cash flow chart. */
export function cashflowText(t: CashflowTotals, fmt: Formatters): string {
  if (t.months === 0 || isQuiet(t)) return 'No income or spend in this period.';
  const span = t.months === 1 ? '1 month' : `${t.months} months`;
  const kept =
    t.net >= 0
      ? `kept ${fmt.money(t.net)}${t.savingsRate != null ? ` (${fmt.percent(t.savingsRate)} of income)` : ''}`
      : `spent ${fmt.money(-t.net)} more than came in`;
  let text = `Across ${span}: ${fmt.money(t.income)} in, ${fmt.money(t.spend)} out, ${kept}.`;
  if (t.months > 1 && t.best && t.worst && t.best.month !== t.worst.month) {
    text +=
      ` Best month ${monthName(t.best.month, fmt)} at ${fmt.money(t.best.net, undefined, { sign: signFor(t.best.net) })},` +
      ` weakest ${monthName(t.worst.month, fmt)} at ${fmt.money(t.worst.net, undefined, { sign: signFor(t.worst.net) })}.`;
  }
  return text;
}

/* ---------------------------------------------------------------- daily spend */

export interface TrendStats {
  total: number;
  /** Mean over every day in the window, including days with no spend. */
  perDay: number;
  /** Days with any spend. */
  activeDays: number;
  peak: { date: string; amount: number } | null;
}

export function trendStats(days: readonly SpendingTrendDay[]): TrendStats {
  let total = 0;
  let activeDays = 0;
  let peak: TrendStats['peak'] = null;
  for (const d of days) {
    const a = num(d.amount);
    total += a;
    if (a > 0) activeDays += 1;
    if (a > 0 && (!peak || a > peak.amount)) peak = { date: d.date, amount: a };
  }
  return { total, perDay: days.length ? total / days.length : 0, activeDays, peak };
}

export function trendText(s: TrendStats, dayCount: number, fmt: Formatters): string {
  if (s.total === 0) return 'No spending in this period.';
  const peak = s.peak
    ? ` The biggest day was ${fmt.date(s.peak.date)} at ${fmt.money(s.peak.amount)}.`
    : '';
  return (
    `${fmt.money(s.total)} spent over ${dayCount} days, ${fmt.money(s.perDay)} a day on average,` +
    ` with spending on ${s.activeDays} of them.${peak}`
  );
}

/* ---------------------------------------------------------------- net worth */

export interface NetWorthRange {
  start: number;
  end: number;
  change: number;
  /** Against the start; null when it started at zero. */
  percent: number | null;
  high: { date: string; value: number };
  low: { date: string; value: number };
  /** Per account type at the last point. */
  sheet: BalanceSheet;
}

export function netWorthRange(points: readonly NetWorthPoint[]): NetWorthRange | null {
  if (points.length === 0) return null;
  const values = points.map((p) => num(p.total));
  const start = values[0];
  const end = values[values.length - 1];
  let hi = 0;
  let lo = 0;
  values.forEach((v, i) => {
    if (v > values[hi]) hi = i;
    if (v < values[lo]) lo = i;
  });
  return {
    start,
    end,
    change: end - start,
    percent: start === 0 ? null : ((end - start) / Math.abs(start)) * 100,
    high: { date: points[hi].date, value: values[hi] },
    low: { date: points[lo].date, value: values[lo] },
    sheet: balanceSheet(points[points.length - 1].by_type, []),
  };
}

export function netWorthText(r: NetWorthRange, fmt: Formatters): string {
  const dir = r.change > 0 ? 'up' : r.change < 0 ? 'down' : 'flat';
  const by =
    r.change === 0
      ? ''
      : ` ${fmt.money(Math.abs(r.change))}${r.percent != null ? ` (${fmt.percent(Math.abs(r.percent))})` : ''}`;
  return (
    `Net worth went from ${fmt.money(r.start)} to ${fmt.money(r.end)}, ${dir}${by}.` +
    ` High ${fmt.money(r.high.value)} on ${fmt.date(r.high.date)}, low ${fmt.money(r.low.value)} on ${fmt.date(r.low.date)}.`
  );
}

/* ---------------------------------------------------------------- budgets */

/** "3 budgets: 1 exceeded, 1 at warning, 1 on track." */
export function budgetCountText(rows: readonly BudgetRow[]): string {
  const count = (h: BudgetHealth) => rows.filter((r) => r.health === h).length;
  const noun = rows.length === 1 ? 'budget' : 'budgets';
  return `${rows.length} ${noun}: ${count(BudgetHealth.Over)} exceeded, ${count(BudgetHealth.Warning)} at warning, ${count(BudgetHealth.OnTrack)} on track.`;
}

/* ---------------------------------------------------------------- shared */

export const signFor = (n: number) => (n > 0 ? SignDisplay.Always : SignDisplay.Auto);
