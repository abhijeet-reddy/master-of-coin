/**
 * The report period: a preset or a custom from/to, resolved against today, and how each
 * server aggregate is asked for it. Pure; no React.
 */
import { HistoryInterval } from '@/api/analytics';
import { toDate, toIsoDate } from '@/lib/format';

export enum ReportTab {
  Cashflow = 'cashflow',
  Categories = 'categories',
  Budgets = 'budgets',
  NetWorth = 'net-worth',
}

export const REPORT_TABS = [
  ReportTab.Cashflow,
  ReportTab.Categories,
  ReportTab.Budgets,
  ReportTab.NetWorth,
] as const;

export const REPORT_TAB_LABEL: Record<ReportTab, string> = {
  [ReportTab.Cashflow]: 'Cash flow',
  [ReportTab.Categories]: 'Categories',
  [ReportTab.Budgets]: 'Budgets',
  [ReportTab.NetWorth]: 'Net worth',
};

/** Tabs whose figures follow the chosen period. The others have no ranged aggregate. */
export const RANGED_TABS: ReadonlySet<ReportTab> = new Set([
  ReportTab.Cashflow,
  ReportTab.NetWorth,
]);

export enum RangePreset {
  ThisMonth = 'month',
  ThreeMonths = '3m',
  SixMonths = '6m',
  TwelveMonths = '12m',
  YearToDate = 'ytd',
  Custom = 'custom',
}

export const RANGE_PRESETS = [
  RangePreset.ThisMonth,
  RangePreset.ThreeMonths,
  RangePreset.SixMonths,
  RangePreset.TwelveMonths,
  RangePreset.YearToDate,
  RangePreset.Custom,
] as const;

export const RANGE_LABEL: Record<RangePreset, string> = {
  [RangePreset.ThisMonth]: 'This month',
  [RangePreset.ThreeMonths]: 'Last 3 months',
  [RangePreset.SixMonths]: 'Last 6 months',
  [RangePreset.TwelveMonths]: 'Last 12 months',
  [RangePreset.YearToDate]: 'Year to date',
  [RangePreset.Custom]: 'Custom',
};

export const DEFAULT_PRESET = RangePreset.SixMonths;

/** `/analytics/monthly` accepts 1 to 120 months. */
export const MAX_MONTHS = 120;
/** `/analytics/spending-trend` accepts at most 1000 days. */
export const MAX_TREND_DAYS = 1000;
/** Up to this many days, net worth is plotted weekly; beyond it, monthly. */
export const WEEKLY_MAX_DAYS = 120;

export interface DateRange {
  /** `YYYY-MM-DD`, inclusive. */
  from: string;
  /** `YYYY-MM-DD`, inclusive. */
  to: string;
}

const DAY = 864e5;

const firstOfMonth = (d: Date, back = 0) => new Date(d.getFullYear(), d.getMonth() - back, 1);

/** The range a preset covers, ending today. Custom falls back to the default preset. */
export function presetRange(preset: RangePreset, today: Date): DateRange {
  const to = toIsoDate(today);
  switch (preset) {
    case RangePreset.ThisMonth:
      return { from: toIsoDate(firstOfMonth(today)), to };
    case RangePreset.ThreeMonths:
      return { from: toIsoDate(firstOfMonth(today, 2)), to };
    case RangePreset.TwelveMonths:
      return { from: toIsoDate(firstOfMonth(today, 11)), to };
    case RangePreset.YearToDate:
      return { from: toIsoDate(new Date(today.getFullYear(), 0, 1)), to };
    default:
      return { from: toIsoDate(firstOfMonth(today, 5)), to };
  }
}

/** The effective range: a preset's, or the custom dates (missing ends filled, swapped if reversed). */
export function resolveRange(
  preset: RangePreset,
  from: string | undefined,
  to: string | undefined,
  today: Date
): DateRange {
  if (preset !== RangePreset.Custom) return presetRange(preset, today);
  const fallback = presetRange(DEFAULT_PRESET, today);
  const a = from && toDate(from) ? from : fallback.from;
  const b = to && toDate(to) ? to : fallback.to;
  return a <= b ? { from: a, to: b } : { from: b, to: a };
}

/** Inclusive day count. */
export function daysIn(range: DateRange): number {
  const a = toDate(range.from);
  const b = toDate(range.to);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / DAY) + 1;
}

/** `YYYY-MM` of a `YYYY-MM-DD`. */
export const monthKey = (iso: string) => iso.slice(0, 7);

const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth();

/**
 * `/analytics/monthly` always ends at the current month, so ask for enough months to reach
 * back to the range's first month. `clipped` when that is more than the server allows.
 */
export function monthsToRequest(
  range: DateRange,
  today: Date
): { months: number; clipped: boolean } {
  const from = toDate(range.from);
  if (!from) return { months: 1, clipped: false };
  const need = monthIndex(today) - monthIndex(from) + 1;
  return { months: Math.max(1, Math.min(MAX_MONTHS, need)), clipped: need > MAX_MONTHS };
}

/** Rows of a monthly series that fall in the range's months, oldest first. */
export function monthsInRange<T extends { month: string }>(
  series: readonly T[],
  range: DateRange
): T[] {
  const a = monthKey(range.from);
  const b = monthKey(range.to);
  return series.filter((m) => m.month >= a && m.month <= b);
}

/** The daily spend window: the range, or its last 1000 days when longer. */
export function trendWindow(range: DateRange): { range: DateRange; clipped: boolean } {
  if (daysIn(range) <= MAX_TREND_DAYS) return { range, clipped: false };
  const to = toDate(range.to) as Date;
  const from = new Date(to.getFullYear(), to.getMonth(), to.getDate() - (MAX_TREND_DAYS - 1));
  return { range: { from: toIsoDate(from), to: range.to }, clipped: true };
}

/** Weekly points for a short range, monthly for a long one. */
export const historyInterval = (range: DateRange): HistoryInterval =>
  daysIn(range) <= WEEKLY_MAX_DAYS ? HistoryInterval.Week : HistoryInterval.Month;

/** True when the range ends before its months do, e.g. a month that is still running. */
export const partialMonths = (range: DateRange): boolean =>
  !range.from.endsWith('-01') || toDate(range.to)?.getDate() !== lastDay(range.to);

function lastDay(iso: string): number {
  const d = toDate(iso);
  return d ? new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() : 0;
}
