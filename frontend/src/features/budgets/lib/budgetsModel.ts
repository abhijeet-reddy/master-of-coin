/**
 * Pure budget maths for the list and detail pages. Dates are the server's
 * `YYYY-MM-DD` calendar days (it counts periods in UTC days); percentages are
 * 0 to 100 and above.
 */
import {
  BudgetHealth,
  type Budget,
  type BudgetPeriod,
  type BudgetRange,
  type Transaction,
} from '@/api/types';
import { toNumber } from '@/lib/format';

export const PERIODS: readonly BudgetPeriod[] = [
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'YEARLY',
];

export const PERIOD_LABEL: Record<BudgetPeriod, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  YEARLY: 'Yearly',
};

/** How spending compares with time elapsed. */
export enum Pace {
  OnTrack = 'on_track',
  Ahead = 'ahead',
  Over = 'over',
  /** No active range, so nothing to pace against. */
  None = 'none',
}

export const PACE_LABEL: Record<Pace, string> = {
  [Pace.OnTrack]: 'On track',
  [Pace.Ahead]: 'Ahead of pace',
  [Pace.Over]: 'Over limit',
  [Pace.None]: 'No active range',
};

/** Spend this many points ahead of time elapsed before it reads as ahead of pace. */
export const PACE_SLACK = 3;
export const WARN_AT = 80;

const DAY = 86_400_000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})/;

/** Days since the epoch for a `YYYY-MM-DD` (or ISO datetime, date part) string. */
export function dayNumber(iso: string): number | null {
  const m = ISO_RE.exec(iso);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(t) ? Math.round(t / DAY) : null;
}

/** Today's calendar day in UTC, the day the server counts in. */
export const todayUtc = (now: Date = new Date()) => now.toISOString().slice(0, 10);

export function isoFromDayNumber(n: number): string {
  return new Date(n * DAY).toISOString().slice(0, 10);
}

/** Inclusive length of a window in days. */
export function periodDays(start: string, end: string): number {
  const s = dayNumber(start);
  const e = dayNumber(end);
  if (s === null || e === null || e < s) return 0;
  return e - s + 1;
}

/**
 * Days left counting today (the server's `days_left`), 0 once the window has
 * ended. Falls back to working it out from today when the server leaves it out.
 */
export function daysLeft(
  start: string,
  end: string,
  serverDaysLeft: number | null | undefined,
  today: string = todayUtc()
): number {
  const total = periodDays(start, end);
  if (serverDaysLeft != null && Number.isFinite(serverDaysLeft)) {
    return Math.max(0, Math.min(total, Math.floor(serverDaysLeft)));
  }
  const e = dayNumber(end);
  const t = dayNumber(today);
  if (e === null || t === null) return 0;
  return Math.max(0, Math.min(total, e - t + 1));
}

/** Which day of the period today is (1 based), capped to the period. */
export function elapsedDays(total: number, left: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(total, total - left + 1));
}

export function paceOf(percent: number, elapsedPct: number): Pace {
  if (percent > 100) return Pace.Over;
  if (percent > elapsedPct + PACE_SLACK) return Pace.Ahead;
  return Pace.OnTrack;
}

/** Server status wins; otherwise the same thresholds (over past 100, warning from 80). */
export function healthOf(b: Pick<Budget, 'status' | 'percentage_used'>): BudgetHealth | null {
  if (b.status) return b.status;
  const p = b.percentage_used;
  if (p == null || !Number.isFinite(p)) return null;
  if (p > 100) return BudgetHealth.Over;
  if (p >= WARN_AT) return BudgetHealth.Warning;
  return BudgetHealth.OnTrack;
}

export interface BudgetStats {
  id: string;
  name: string;
  budget: Budget;
  /** False when no range covers today: nothing below is meaningful. */
  active: boolean;
  period?: BudgetPeriod;
  start?: string;
  end?: string;
  currency?: string;
  limit: number;
  spent: number;
  /** Negative when over. */
  remaining: number;
  percent: number;
  health: BudgetHealth | null;
  totalDays: number;
  daysLeft: number;
  /** Day of the period today is, 1 based. */
  elapsed: number;
  elapsedPct: number;
  pace: Pace;
  /** What can still go out per remaining day without breaking the limit; 0 once over. */
  safePerDay: number;
}

const num = (v: string | number | null | undefined) => {
  const n = toNumber(v);
  return Number.isFinite(n) ? n : 0;
};

export function budgetStats(b: Budget, today: string = todayUtc()): BudgetStats {
  const r = b.active_range;
  if (!r) {
    return {
      id: b.id,
      name: b.name,
      budget: b,
      active: false,
      currency: b.currency ?? undefined,
      limit: 0,
      spent: 0,
      remaining: 0,
      percent: 0,
      health: null,
      totalDays: 0,
      daysLeft: 0,
      elapsed: 0,
      elapsedPct: 0,
      pace: Pace.None,
      safePerDay: 0,
    };
  }
  const end = r.end_date ?? r.start_date;
  const limit = num(r.limit_amount);
  const spent = num(b.current_spending);
  const remaining = b.remaining != null ? num(b.remaining) : limit - spent;
  const percent =
    b.percentage_used != null && Number.isFinite(b.percentage_used)
      ? b.percentage_used
      : limit > 0
        ? (spent / limit) * 100
        : 0;
  const totalDays = periodDays(r.start_date, end);
  const left = daysLeft(r.start_date, end, b.days_left, today);
  const elapsed = elapsedDays(totalDays, left);
  const elapsedPct = totalDays ? (elapsed / totalDays) * 100 : 0;
  return {
    id: b.id,
    name: b.name,
    budget: b,
    active: true,
    period: r.period,
    start: r.start_date,
    end,
    currency: b.currency ?? undefined,
    limit,
    spent,
    remaining,
    percent,
    health: healthOf({ status: b.status, percentage_used: percent }),
    totalDays,
    daysLeft: left,
    elapsed,
    elapsedPct,
    pace: paceOf(percent, elapsedPct),
    safePerDay: remaining > 0 && left > 0 ? remaining / left : 0,
  };
}

const HEALTH_RANK: Record<BudgetHealth, number> = {
  [BudgetHealth.Over]: 0,
  [BudgetHealth.Warning]: 1,
  [BudgetHealth.OnTrack]: 2,
};

/** Worst first (over, warning, ok), budgets with no active range last, then by name. */
export function sortBudgets(list: BudgetStats[]): BudgetStats[] {
  return [...list].sort((a, b) => {
    const ra = a.health ? HEALTH_RANK[a.health] : 3;
    const rb = b.health ? HEALTH_RANK[b.health] : 3;
    if (ra !== rb) return ra - rb;
    if (a.health && b.health && a.percent !== b.percent) return b.percent - a.percent;
    return a.name.localeCompare(b.name);
  });
}

export type PeriodFilter = BudgetPeriod | 'ALL';

export function filterByPeriod(list: BudgetStats[], period: PeriodFilter): BudgetStats[] {
  return period === 'ALL' ? list : list.filter((s) => s.period === period);
}

export function periodCounts(list: BudgetStats[]): Record<PeriodFilter, number> {
  const out = { ALL: list.length } as Record<PeriodFilter, number>;
  for (const p of PERIODS) out[p] = list.filter((s) => s.period === p).length;
  return out;
}

export interface Overall {
  /** Budgets with an active range; the rest have nothing to add up. */
  counted: number;
  limit: number;
  spent: number;
  remaining: number;
  /** Combined: total spent over total limit. */
  percent: number;
  /** Mean of each budget's own usage, so a large limit does not drown a small one. */
  averagePercent: number | null;
  health: BudgetHealth | null;
  ok: number;
  warning: number;
  over: number;
  /** Active budgets whose pace is not on track. */
  offPace: number;
}

export function overall(list: BudgetStats[]): Overall {
  const act = list.filter((s) => s.active);
  const limit = act.reduce((t, s) => t + s.limit, 0);
  const spent = act.reduce((t, s) => t + s.spent, 0);
  const percent = limit > 0 ? (spent / limit) * 100 : 0;
  const averagePercent = act.length ? act.reduce((t, s) => t + s.percent, 0) / act.length : null;
  return {
    counted: act.length,
    limit,
    spent,
    remaining: limit - spent,
    percent,
    averagePercent,
    health: act.length ? healthOf({ percentage_used: percent }) : null,
    ok: act.filter((s) => s.health === BudgetHealth.OnTrack).length,
    warning: act.filter((s) => s.health === BudgetHealth.Warning).length,
    over: act.filter((s) => s.health === BudgetHealth.Over).length,
    offPace: act.filter((s) => s.pace !== Pace.OnTrack).length,
  };
}

/* ------------------------------------------------------------ pace chart */

/** What a transaction adds to a budget: money out, less what others owe back. */
export function spendOf(t: Pick<Transaction, 'amount' | 'splits'>): number {
  const amount = num(t.amount);
  if (amount >= 0) return 0;
  const owed = (t.splits ?? []).reduce((s, x) => s + Math.max(0, num(x.amount)), 0);
  return Math.max(0, Math.abs(amount) - owed);
}

export interface PaceSeries {
  /** One `YYYY-MM-DD` per day of the period. */
  days: string[];
  /** Cumulative spend per elapsed day, ending at the server's figure. */
  actual: number[];
}

/**
 * Cumulative daily spend across the period, from the transactions in the
 * window. The server converts currencies and leaves out excluded categories,
 * so the series is scaled to end exactly on its `current_spending`.
 */
export function paceSeries(
  start: string,
  end: string,
  elapsed: number,
  txs: Pick<Transaction, 'amount' | 'splits' | 'date'>[],
  serverSpent: number
): PaceSeries {
  const s = dayNumber(start);
  const total = periodDays(start, end);
  if (s === null || total <= 0) return { days: [], actual: [] };
  const days = Array.from({ length: total }, (_, i) => isoFromDayNumber(s + i));
  const shown = Math.max(1, Math.min(total, elapsed));
  const perDay = new Array<number>(shown).fill(0);
  for (const t of txs) {
    const d = dayNumber(new Date(t.date).toISOString());
    if (d === null) continue;
    const i = d - s;
    if (i < 0 || i >= shown) continue;
    perDay[i] += spendOf(t);
  }
  let run = 0;
  const raw = perDay.map((v) => (run += v));
  const rawTotal = raw[raw.length - 1] ?? 0;
  const scale = rawTotal > 0 && serverSpent > 0 ? serverSpent / rawTotal : 1;
  const actual = rawTotal > 0 ? raw.map((v) => v * scale) : raw.map(() => 0);
  if (rawTotal <= 0 && serverSpent > 0) actual[actual.length - 1] = serverSpent;
  return { days, actual };
}

/* ------------------------------------------------------------ ranges */

/** The stored range the current period belongs to: the one covering today. */
export function currentRange(
  ranges: BudgetRange[],
  today: string = todayUtc()
): BudgetRange | undefined {
  const t = dayNumber(today);
  if (t === null) return undefined;
  return ranges.find((r) => {
    const s = dayNumber(r.start_date);
    const e = r.end_date ? dayNumber(r.end_date) : null;
    return s !== null && s <= t && (e === null || t <= e);
  });
}

/** Newest first, as the server sends them, whatever order they arrive in. */
export const sortRanges = (ranges: BudgetRange[]) =>
  [...ranges].sort((a, b) => b.start_date.localeCompare(a.start_date));

/* ------------------------------------------------------------ errors */

const FIELD_WORDS: [RegExp, string][] = [
  [/\bend[ _]date\b|\bend\b/i, 'end_date'],
  [/\bstart[ _]date\b|\bstarts?\b/i, 'start_date'],
  [/\blimit/i, 'limit_amount'],
  [/\bperiod\b/i, 'period'],
  [/\bname\b/i, 'name'],
];

/**
 * The server's 422s are plain sentences ("limit_amount: must be positive",
 * "End date must be after start date"). Pick the form field one is about, or
 * null to show it at the top of the form.
 */
export function fieldFromMessage(message: string, fields: readonly string[]): string | null {
  const lead = /^\s*([a-z_]+)\s*:/i.exec(message)?.[1];
  if (lead && fields.includes(lead)) return lead;
  for (const [re, field] of FIELD_WORDS) {
    if (re.test(message) && fields.includes(field)) return field;
  }
  return null;
}

/** Drops a leading `field:` and the validator's "Validation error:" noise. */
export function cleanMessage(message: string): string {
  const m = message
    .replace(/^\s*[a-z_]+\s*:\s*/i, '')
    .replace(/^Validation error:\s*/i, '')
    .trim();
  return m ? m.charAt(0).toUpperCase() + m.slice(1) : message;
}

export interface FormErrorTarget {
  /** The form field to show it on, or null for the message at the top of the form. */
  field: string | null;
  message: string;
}

/**
 * Where a failed save shows its error: 422s on the field they are about when
 * one can be told, 409s (an overlapping range) and the rest at the top.
 */
export function formErrorTarget(
  err: { kind: string; message: string; fieldErrors?: Record<string, string> },
  fields: readonly string[]
): FormErrorTarget {
  if (err.kind !== 'validation') return { field: null, message: err.message };
  const known = Object.entries(err.fieldErrors ?? {}).find(([k]) => fields.includes(k));
  if (known) return { field: known[0], message: known[1] };
  const field = fieldFromMessage(err.message, fields);
  return { field, message: field ? cleanMessage(err.message) : err.message };
}

/* ------------------------------------------------------------ pace monitor */

/** Axes of the pace monitor: time elapsed 0 to 100, limit used 0 to PACE_Y_MAX. */
export const PACE_Y_MAX = 150;

/**
 * Nudge label baselines apart so none sit closer than `gap`, keeping the
 * order and staying inside [min, max]. Input and output are in the same order.
 */
export function spreadLabels(ys: number[], gap: number, min: number, max: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  const out = new Array<number>(ys.length);
  let prev = -Infinity;
  for (const o of order) {
    const y = Math.max(o.y, prev + gap, min);
    out[o.i] = y;
    prev = y;
  }
  // Pushed off the bottom: walk back up.
  let next = Infinity;
  for (let k = order.length - 1; k >= 0; k--) {
    const i = order[k].i;
    out[i] = Math.min(out[i], next - gap, max);
    next = out[i];
  }
  return out;
}
