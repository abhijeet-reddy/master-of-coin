/**
 * Pure formatters. Every function takes the user's preferences explicitly so
 * it can be tested and used outside React; components use `usePreferences()`.
 */
import { DEFAULT_PREFERENCES, DateFormat, type UserPreferences } from '@/api/types/preferences';

export type Decimalish = string | number | null | undefined;

/** ASCII hyphen-minus: the one sign used for every negative figure (`-€420.00`). */
export const MINUS = '-';

/** Parse a backend decimal string. Returns NaN (never a silent 0) when it is not a number. */
export function toNumber(value: Decimalish): number {
  if (value === null || value === undefined || value === '') return Number.NaN;
  if (typeof value === 'number') return value;
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : Number.NaN;
}

export enum Sign {
  Pos = 'pos',
  Neg = 'neg',
  Zero = 'zero',
}

export function signOf(value: Decimalish): Sign {
  const n = toNumber(value);
  if (!Number.isFinite(n) || n === 0) return Sign.Zero;
  return n > 0 ? Sign.Pos : Sign.Neg;
}

/** How a sign is shown in front of a figure. */
export enum SignDisplay {
  /** A minus for negatives only. */
  Auto = 'auto',
  /** Always + or minus (flows: income, spend, deltas). */
  Always = 'always',
  /** Absolute value (balances with a label). */
  Never = 'never',
}

export interface MoneyOptions {
  sign?: SignDisplay;
  /** Compact notation (`€45.1K`) for chart axes. */
  compact?: boolean;
  /** Drop the fraction digits (`€1,450`). */
  whole?: boolean;
}

const nfCache = new Map<string, Intl.NumberFormat>();
function nf(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = nfCache.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat(locale, options);
    } catch {
      f = new Intl.NumberFormat(DEFAULT_PREFERENCES.number_locale, options);
    }
    nfCache.set(key, f);
  }
  return f;
}

function withSign(formattedAbs: string, n: number, sign: MoneyOptions['sign']): string {
  if (sign === SignDisplay.Never || n === 0) return formattedAbs;
  if (n < 0) return `${MINUS}${formattedAbs}`;
  return sign === SignDisplay.Always ? `+${formattedAbs}` : formattedAbs;
}

/** `€1,234.50`, `-€38.60`, `+€5,282.00`. Returns `--` when the amount is unknown. */
export function formatMoney(
  amount: Decimalish,
  currency: string,
  prefs: Pick<UserPreferences, 'number_locale'> = DEFAULT_PREFERENCES,
  options: MoneyOptions = {}
): string {
  const n = toNumber(amount);
  if (!Number.isFinite(n)) return '--';
  const { sign = SignDisplay.Auto, compact = false, whole = false } = options;
  let code = currency || DEFAULT_PREFERENCES.default_currency;
  try {
    new Intl.NumberFormat('en-US', { style: 'currency', currency: code });
  } catch {
    code = DEFAULT_PREFERENCES.default_currency;
  }
  const opts: Intl.NumberFormatOptions = {
    style: 'currency',
    currency: code,
    ...(compact
      ? { notation: 'compact', maximumFractionDigits: 1 }
      : whole
        ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
        : {}),
  };
  return withSign(nf(prefs.number_locale, opts).format(Math.abs(n)), n, sign);
}

export function formatNumber(
  value: Decimalish,
  prefs: Pick<UserPreferences, 'number_locale'> = DEFAULT_PREFERENCES,
  options: Intl.NumberFormatOptions & { sign?: MoneyOptions['sign'] } = {}
): string {
  const n = toNumber(value);
  if (!Number.isFinite(n)) return '--';
  const { sign = SignDisplay.Auto, ...intl } = options;
  return withSign(nf(prefs.number_locale, intl).format(Math.abs(n)), n, sign);
}

/** `percent` is already a percentage (73.4 => `73%`). */
export function formatPercent(
  percent: Decimalish,
  prefs: Pick<UserPreferences, 'number_locale'> = DEFAULT_PREFERENCES,
  digits = 0
): string {
  const n = toNumber(percent);
  if (!Number.isFinite(n)) return '--';
  return withSign(
    nf(prefs.number_locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(Math.abs(n)) + '%',
    n,
    SignDisplay.Auto
  );
}

/**
 * Parse a date. `YYYY-MM-DD` strings are read as LOCAL calendar dates, so a
 * transaction dated 2026-09-25 never shows as the 24th west of UTC.
 */
export function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DD` in local time, for APIs and URL params. */
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export enum DateStyle {
  Short = 'short',
  Medium = 'medium',
  DayMonth = 'dayMonth',
  MonthYear = 'monthYear',
  Time = 'time',
  DateTime = 'dateTime',
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * - `short`: the user's pattern, `25/09/2026` | `09/25/2026` | `2026-09-25`
 * - `medium`: `25 Sep 2026` (or `Sep 25, 2026` for MM/DD/YYYY users)
 * - `dayMonth`: `25 Sep` / `Sep 25`
 * - `monthYear`: `Sep 2026`
 * - `time`: `14:05`
 * - `dateTime`: short date plus time
 */
export function formatDate(
  value: string | Date | null | undefined,
  prefs: Pick<UserPreferences, 'date_format'> = DEFAULT_PREFERENCES,
  style: DateStyle = DateStyle.Short
): string {
  const d = toDate(value);
  if (!d) return '--';
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const mon = MONTHS[d.getMonth()];
  const monthFirst = prefs.date_format === DateFormat.MDY;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  switch (style) {
    case DateStyle.Medium:
      return monthFirst ? `${mon} ${d.getDate()}, ${year}` : `${d.getDate()} ${mon} ${year}`;
    case DateStyle.DayMonth:
      return monthFirst ? `${mon} ${d.getDate()}` : `${d.getDate()} ${mon}`;
    case DateStyle.MonthYear:
      return `${mon} ${year}`;
    case DateStyle.Time:
      return time;
    case DateStyle.DateTime:
      return `${formatDate(d, prefs, DateStyle.Short)} ${time}`;
    case DateStyle.Short:
    default:
      if (prefs.date_format === DateFormat.ISO) return `${year}-${month}-${day}`;
      return monthFirst ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
  }
}

/** `just now`, `12 min ago`, `3 h ago`, `2 d ago`, then the medium date. */
export function formatRelative(
  value: string | Date | null | undefined,
  now: Date = new Date(),
  prefs: Pick<UserPreferences, 'date_format'> = DEFAULT_PREFERENCES
): string {
  const d = toDate(value);
  if (!d) return 'never';
  const s = Math.round((now.getTime() - d.getTime()) / 1000);
  if (s < 0) return formatDate(d, prefs, DateStyle.Medium);
  if (s < 60) return 'just now';
  const min = Math.floor(s / 60);
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days} d ago`;
  return formatDate(d, prefs, DateStyle.Medium);
}

/** Start of the week containing `date`, honouring the week_start preference (1 Mon, 7 Sun). */
export function startOfWeek(date: Date, weekStart: UserPreferences['week_start'] = 1): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const isoDay = d.getDay() === 0 ? 7 : d.getDay();
  const diff = (isoDay - weekStart + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

/** Everything bound to one set of preferences. */
export interface Formatters {
  money: (amount: Decimalish, currency?: string, options?: MoneyOptions) => string;
  number: (
    value: Decimalish,
    options?: Intl.NumberFormatOptions & { sign?: MoneyOptions['sign'] }
  ) => string;
  percent: (percent: Decimalish, digits?: number) => string;
  date: (value: string | Date | null | undefined, style?: DateStyle) => string;
  relative: (value: string | Date | null | undefined, now?: Date) => string;
}

export function createFormatters(prefs: UserPreferences = DEFAULT_PREFERENCES): Formatters {
  return {
    money: (amount, currency = prefs.default_currency, options) =>
      formatMoney(amount, currency, prefs, options),
    number: (value, options) => formatNumber(value, prefs, options),
    percent: (percent, digits) => formatPercent(percent, prefs, digits),
    date: (value, style) => formatDate(value, prefs, style),
    relative: (value, now) => formatRelative(value, now, prefs),
  };
}
