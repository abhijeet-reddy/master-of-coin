/**
 * Pure view model for the categories pages: sorting, the month axis, and
 * spend per category and per month in the user's default currency.
 */
import type { Account, Category, Transaction } from '@/api/types';
import { toNumber } from '@/lib/format';
import { convert, type RateTable } from '@/lib/fx';
import { localDay } from '@/features/transactions/lib/datetime';

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Alphabetical, case and accent insensitive. */
export function sortCategories<T extends Pick<Category, 'name'>>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

/** Filter by a search string over the name. */
export function searchCategories<T extends Pick<Category, 'name'>>(
  list: readonly T[],
  q: string
): T[] {
  const needle = q.trim().toLocaleLowerCase();
  return needle ? list.filter((c) => c.name.toLocaleLowerCase().includes(needle)) : [...list];
}

const pad = (n: number) => String(n).padStart(2, '0');
const monthOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

/** The last `n` local months, oldest first, ending with the current one (`YYYY-MM`). */
export function lastMonths(n: number, now: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--)
    out.push(monthOf(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  return out;
}

/** Local start of the first month and the last instant of the last, as ISO instants. */
export function monthsWindow(months: readonly string[]): { start_date: string; end_date: string } {
  const [fy, fm] = months[0].split('-').map(Number);
  const [ly, lm] = months[months.length - 1].split('-').map(Number);
  const start = new Date(fy, fm - 1, 1);
  const end = new Date(new Date(ly, lm, 1).getTime() - 1);
  return { start_date: start.toISOString(), end_date: end.toISOString() };
}

export interface SpendContext {
  accounts: ReadonlyMap<string, Pick<Account, 'currency'>>;
  base: string;
  rates: RateTable | null;
}

/** Money out, as a positive amount in the default currency; transfers do not count. */
function spendOf(
  tx: Transaction,
  ctx: SpendContext
): { value: number | null; currency: string } | null {
  const amount = toNumber(tx.amount);
  if (!(amount < 0) || tx.transfer_info) return null;
  const account = ctx.accounts.get(tx.account_id);
  const currency = account ? String(account.currency) : ctx.base;
  return { value: convert(-amount, currency, ctx.base, ctx.rates), currency };
}

export interface MonthSpend {
  month: string;
  total: number;
}

/**
 * Spend per month over `months`, oldest first. `missing` lists currencies
 * with no rate; those rows are left out rather than added unconverted.
 */
export function monthlySpend(
  txs: readonly Transaction[],
  months: readonly string[],
  ctx: SpendContext
): { series: MonthSpend[]; missing: string[] } {
  const totals = new Map(months.map((m) => [m, 0]));
  const missing = new Set<string>();
  for (const tx of txs) {
    const s = spendOf(tx, ctx);
    if (!s) continue;
    const month = localDay(tx.date).slice(0, 7);
    if (!totals.has(month)) continue;
    if (s.value === null) missing.add(s.currency);
    else totals.set(month, totals.get(month)! + s.value);
  }
  return {
    series: months.map((month) => ({ month, total: round2(totals.get(month)!) })),
    missing: [...missing],
  };
}

/** Spend per category id (uncategorised rows are skipped). */
export function spendByCategory(
  txs: readonly Transaction[],
  ctx: SpendContext
): Map<string, number> {
  const out = new Map<string, number>();
  for (const tx of txs) {
    if (!tx.category_id) continue;
    const s = spendOf(tx, ctx);
    if (!s || s.value === null) continue;
    out.set(tx.category_id, round2((out.get(tx.category_id) ?? 0) + s.value));
  }
  return out;
}

export interface SpendStats {
  total: number;
  average: number;
  /** The month with the most spend, or null when nothing was spent. */
  peak: MonthSpend | null;
  thisMonth: number;
  /** This month against the average of the earlier months, as a percentage; null without history. */
  vsAverage: number | null;
  /** The average of the months before this one. */
  earlierAverage: number;
}

export function spendStats(series: readonly MonthSpend[]): SpendStats {
  const total = round2(series.reduce((s, m) => s + m.total, 0));
  const average = series.length ? round2(total / series.length) : 0;
  const peak = series.reduce<MonthSpend | null>(
    (best, m) => (m.total > 0 && (!best || m.total > best.total) ? m : best),
    null
  );
  const thisMonth = series.length ? series[series.length - 1].total : 0;
  const earlier = series.slice(0, -1);
  const earlierAvg = earlier.length ? earlier.reduce((s, m) => s + m.total, 0) / earlier.length : 0;
  const vsAverage =
    earlierAvg > 0 ? Math.round(((thisMonth - earlierAvg) / earlierAvg) * 100) : null;
  return { total, average, peak, thisMonth, vsAverage, earlierAverage: round2(earlierAvg) };
}

/** Below this, an average is too small for a percentage to mean anything. */
export const TINY_AVERAGE = 1;
/** Percentages above this read "over 999%". */
export const VS_AVERAGE_CAP = 999;

/**
 * The "vs average" note under this month's spend. A zero or tiny earlier average reads "New"
 * rather than a percentage in the thousands, and anything above the cap reads "Over 999%".
 */
export function vsAverageLabel(thisMonth: number, earlierAverage: number): string {
  if (earlierAverage < TINY_AVERAGE) return thisMonth > 0 ? 'New vs average' : 'No earlier spend';
  const pct = Math.round(((thisMonth - earlierAverage) / earlierAverage) * 100);
  if (pct > VS_AVERAGE_CAP) return `Over ${VS_AVERAGE_CAP}% vs average`;
  return `${pct > 0 ? '+' : ''}${pct}% vs average`;
}

const MONTH_ABBR = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** `2026-09` as `Sep`, or `Sep 26` when the axis crosses a year. */
export function monthTick(month: string, withYear: boolean): string {
  const [y, m] = month.split('-').map(Number);
  const label = MONTH_ABBR[m - 1] ?? month;
  return withYear ? `${label} ${String(y).slice(2)}` : label;
}
