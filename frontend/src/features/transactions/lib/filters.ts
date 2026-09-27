/**
 * The transactions filter state: a URL schema (every filter is shareable and
 * survives reload), and the pure mapping from that state to the server's
 * GET /transactions query. Filtering and paging are always server side.
 */
import { z } from 'zod';
import { u } from '@/lib/urlState';

export const PAGE_SIZE = 100;
export const SEARCH_MAX = 100;
/** Category filter value matching rows with no category (the server's sentinel). */
export const UNCATEGORISED = 'uncategorised';

export const DIRECTIONS = ['all', 'in', 'out'] as const;
export type Direction = (typeof DIRECTIONS)[number];
export const PAID_BY = ['all', 'only', 'exclude'] as const;
export type PaidBy = (typeof PAID_BY)[number];

/** `?q=&month=2026-08&account=a,b&dir=out&page=2` and so on. Defaults stay out of the URL. */
export const filterSchema = z.object({
  q: u.string(),
  /** `YYYY-MM`; empty means the current month. */
  month: u.string(),
  account: u.array(),
  category: u.array(),
  person: u.optionalString(),
  from: u.date(),
  to: u.date(),
  min: u.optionalNumber(),
  max: u.optionalNumber(),
  dir: u.enum(DIRECTIONS, 'all'),
  splits: u.boolean(false),
  transfer: u.boolean(false),
  paid: u.enum(PAID_BY, 'all'),
  page: u.number(1),
});

export type TxFilters = z.infer<typeof filterSchema>;

/** The query sent to GET /transactions. */
export interface TxListParams {
  start_date?: string;
  end_date?: string;
  account_id?: string;
  category_id?: string;
  person_id?: string;
  search?: string;
  sign?: 'positive' | 'negative';
  min_amount?: number;
  max_amount?: number;
  has_splits?: boolean;
  in_transfer?: boolean;
  paid_by_others?: 'only' | 'exclude';
  limit: number;
  offset: number;
}

const MONTH_RE = /^(\d{4})-(\d{2})$/;
const pad = (n: number) => String(n).padStart(2, '0');

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** The selected month as `YYYY-MM`; blank or malformed falls back to the current month. */
export function resolveMonth(month: string, now: Date = new Date()): string {
  const m = MONTH_RE.exec(month);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return month;
  return monthKey(now);
}

export function shiftMonth(month: string, delta: number): string {
  const m = MONTH_RE.exec(month);
  if (!m) return month;
  return monthKey(new Date(Number(m[1]), Number(m[2]) - 1 + delta, 1));
}

/** Local start of the month and local start of the next one. */
export function monthBounds(month: string): { start: Date; end: Date } {
  const m = MONTH_RE.exec(month)!;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  return { start: new Date(y, mo, 1), end: new Date(y, mo + 1, 1) };
}

/** Whole months between `month` and now (0 for the current month). */
export function monthsAgo(month: string, now: Date = new Date()): number {
  const m = MONTH_RE.exec(month);
  if (!m) return 0;
  return (now.getFullYear() - Number(m[1])) * 12 + now.getMonth() - (Number(m[2]) - 1);
}

function dayStart(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** True when an explicit From or To date replaces the month window. */
export const hasDateRange = (f: Pick<TxFilters, 'from' | 'to'>) => !!(f.from || f.to);

/**
 * The server-side window. Explicit From/To dates win over the month; both are
 * local calendar days sent as UTC instants, so "25 Sep" means 25 Sep where the
 * user is, not in UTC.
 */
export function dateWindow(
  f: Pick<TxFilters, 'from' | 'to' | 'month'>,
  now: Date = new Date()
): { start_date?: string; end_date?: string } {
  if (hasDateRange(f)) {
    const out: { start_date?: string; end_date?: string } = {};
    if (f.from) out.start_date = dayStart(f.from).toISOString();
    if (f.to) {
      const end = dayStart(f.to);
      end.setDate(end.getDate() + 1);
      out.end_date = new Date(end.getTime() - 1).toISOString();
    }
    return out;
  }
  const { start, end } = monthBounds(resolveMonth(f.month, now));
  return { start_date: start.toISOString(), end_date: new Date(end.getTime() - 1).toISOString() };
}

/**
 * The amount range is a SIZE (always positive, as typed), while the server
 * compares signed amounts. Money in maps directly; money out flips and swaps
 * the bounds. With direction All a size range cannot be expressed in one
 * signed range, so it applies to money out (spend is what people filter by)
 * and the rail says so.
 */
export function amountParams(
  f: Pick<TxFilters, 'dir' | 'min' | 'max'>
): Pick<TxListParams, 'sign' | 'min_amount' | 'max_amount'> {
  const min = f.min != null ? Math.abs(f.min) : undefined;
  const max = f.max != null ? Math.abs(f.max) : undefined;
  const hasRange = min !== undefined || max !== undefined;
  if (f.dir === 'in') return { sign: 'positive', min_amount: min, max_amount: max };
  if (f.dir === 'out' || hasRange) {
    return {
      sign: 'negative',
      min_amount: max !== undefined ? -max : undefined,
      max_amount: min !== undefined ? -min : undefined,
    };
  }
  return {};
}

/** True when an amount range is set with direction All, so it silently means money out. */
export const rangeImpliesOut = (f: Pick<TxFilters, 'dir' | 'min' | 'max'>) =>
  f.dir === 'all' && (f.min != null || f.max != null);

/** Map URL filter state to the server query. Undefined keys are left out of the request. */
export function toListParams(f: TxFilters, now: Date = new Date()): TxListParams {
  const page = Math.max(1, Math.floor(f.page) || 1);
  const q = f.q.trim().slice(0, SEARCH_MAX);
  const params: TxListParams = {
    ...dateWindow(f, now),
    ...amountParams(f),
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  };
  if (f.account.length) params.account_id = f.account.join(',');
  if (f.category.length) params.category_id = f.category.join(',');
  if (f.person) params.person_id = f.person;
  if (q) params.search = q;
  if (f.splits) params.has_splits = true;
  if (f.transfer) params.in_transfer = true;
  if (f.paid !== 'all') params.paid_by_others = f.paid;
  for (const k of Object.keys(params) as (keyof TxListParams)[]) {
    if (params[k] === undefined) delete params[k];
  }
  return params;
}

/** Filters other than the month and page; these are what "Clear filters" resets. */
export const FILTER_KEYS = [
  'q',
  'account',
  'category',
  'person',
  'from',
  'to',
  'min',
  'max',
  'dir',
  'splits',
  'transfer',
  'paid',
] as const satisfies readonly (keyof TxFilters)[];

export function clearedFilters(): Partial<TxFilters> {
  return {
    q: '',
    account: [],
    category: [],
    person: undefined,
    from: undefined,
    to: undefined,
    min: undefined,
    max: undefined,
    dir: 'all',
    splits: false,
    transfer: false,
    paid: 'all',
    page: 1,
  };
}

export interface FilterChip {
  key: string;
  label: string;
  /** Patch that removes just this filter. */
  clear: Partial<TxFilters>;
}

export interface ChipNames {
  account: (id: string) => string | undefined;
  category: (id: string) => string | undefined;
  person: (id: string) => string | undefined;
  date: (iso: string) => string;
}

/** One removable chip per active filter, in rail order. */
export function activeChips(f: TxFilters, names: ChipNames): FilterChip[] {
  const chips: FilterChip[] = [];
  if (f.q.trim()) chips.push({ key: 'q', label: `Search: ${f.q.trim()}`, clear: { q: '' } });
  for (const id of f.account) {
    chips.push({
      key: `account:${id}`,
      label: `Account: ${names.account(id) ?? 'Unknown'}`,
      clear: { account: f.account.filter((a) => a !== id) },
    });
  }
  for (const id of f.category) {
    const label = id === UNCATEGORISED ? 'Uncategorised' : (names.category(id) ?? 'Unknown');
    chips.push({
      key: `category:${id}`,
      label: `Category: ${label}`,
      clear: { category: f.category.filter((c) => c !== id) },
    });
  }
  if (f.person) {
    chips.push({
      key: 'person',
      label: `Person: ${names.person(f.person) ?? 'Unknown'}`,
      clear: { person: undefined },
    });
  }
  if (f.from)
    chips.push({ key: 'from', label: `From ${names.date(f.from)}`, clear: { from: undefined } });
  if (f.to) chips.push({ key: 'to', label: `To ${names.date(f.to)}`, clear: { to: undefined } });
  if (f.min != null) chips.push({ key: 'min', label: `Min ${f.min}`, clear: { min: undefined } });
  if (f.max != null) chips.push({ key: 'max', label: `Max ${f.max}`, clear: { max: undefined } });
  if (f.dir !== 'all') {
    chips.push({
      key: 'dir',
      label: f.dir === 'in' ? 'Money in' : 'Money out',
      clear: { dir: 'all' },
    });
  }
  if (f.splits) chips.push({ key: 'splits', label: 'Has splits', clear: { splits: false } });
  if (f.transfer)
    chips.push({ key: 'transfer', label: 'In a transfer', clear: { transfer: false } });
  if (f.paid !== 'all') {
    chips.push({
      key: 'paid',
      label: f.paid === 'only' ? 'Paid by others only' : 'Not paid by others',
      clear: { paid: 'all' },
    });
  }
  return chips.map((c) => ({ ...c, clear: { ...c.clear, page: 1 } }));
}

/** How many filters are active (month and page do not count). */
export const activeFilterCount = (f: TxFilters) =>
  activeChips(f, { account: () => '', category: () => '', person: () => '', date: () => '' })
    .length;
