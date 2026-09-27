import { describe, expect, it } from 'vitest';
import {
  DateStyle,
  MINUS,
  SignDisplay,
  createFormatters,
  formatDate,
  formatMoney,
  formatPercent,
  formatRelative,
  signOf,
  Sign,
  startOfWeek,
  toDate,
  toIsoDate,
} from '@/lib/format';
import { DateFormat, DEFAULT_PREFERENCES } from '@/api/types/preferences';

describe('formatMoney', () => {
  it('formats with the currency symbol and two decimals', () => {
    expect(formatMoney('1234.5', 'EUR')).toBe('€1,234.50');
  });
  it('uses a true minus sign for negatives', () => {
    expect(formatMoney(-38.6, 'EUR')).toBe('-€38.60');
  });
  it('adds + when the sign is always shown', () => {
    expect(formatMoney(5282, 'EUR', undefined, { sign: SignDisplay.Always })).toBe('+€5,282.00');
  });
  it('hides the sign when asked', () => {
    expect(formatMoney(-12, 'EUR', undefined, { sign: SignDisplay.Never })).toBe('€12.00');
  });
  it('supports whole and compact notation', () => {
    expect(formatMoney(1450.4, 'EUR', undefined, { whole: true })).toBe('€1,450');
    expect(formatMoney(45120, 'EUR', undefined, { compact: true })).toBe('€45.1K');
  });
  it('returns -- for unknown amounts and falls back on a bad currency', () => {
    expect(formatMoney(null, 'EUR')).toBe('--');
    expect(formatMoney('abc', 'EUR')).toBe('--');
    expect(formatMoney(1, 'NOTACODE')).toBe('€1.00');
  });
  it('honours the number locale', () => {
    expect(formatMoney(1234.5, 'EUR', { number_locale: 'de-DE' })).toMatch(/^1\.234,50\s€$/);
  });
});

describe('formatPercent and signOf', () => {
  it('formats percentages', () => {
    expect(formatPercent(73.4)).toBe('73%');
    expect(formatPercent(-5.25, undefined, 1)).toBe(`${MINUS}5.3%`);
  });
  it('classifies signs', () => {
    expect(signOf('-1')).toBe(Sign.Neg);
    expect(signOf(0)).toBe(Sign.Zero);
    expect(signOf('2.5')).toBe(Sign.Pos);
  });
});

describe('dates', () => {
  it('reads YYYY-MM-DD as a local date', () => {
    const d = toDate('2026-09-25')!;
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 8, 25]);
    expect(toIsoDate(d)).toBe('2026-09-25');
    expect(toDate('nope')).toBeNull();
  });
  it('follows the date format preference', () => {
    expect(formatDate('2026-09-25', { date_format: DateFormat.DMY })).toBe('25/09/2026');
    expect(formatDate('2026-09-25', { date_format: DateFormat.MDY })).toBe('09/25/2026');
    expect(formatDate('2026-09-25', { date_format: DateFormat.ISO })).toBe('2026-09-25');
    expect(formatDate('2026-09-25', { date_format: DateFormat.DMY }, DateStyle.Medium)).toBe(
      '25 Sep 2026'
    );
    expect(formatDate('2026-09-25', { date_format: DateFormat.MDY }, DateStyle.Medium)).toBe(
      'Sep 25, 2026'
    );
    expect(formatDate(null)).toBe('--');
  });
  it('formats relative times', () => {
    const now = new Date(2026, 8, 27, 12, 0, 0);
    expect(formatRelative(new Date(2026, 8, 27, 11, 59, 30), now)).toBe('just now');
    expect(formatRelative(new Date(2026, 8, 27, 11, 48), now)).toBe('12 min ago');
    expect(formatRelative(new Date(2026, 8, 27, 9, 0), now)).toBe('3 h ago');
    expect(formatRelative(new Date(2026, 8, 25, 12, 0), now)).toBe('2 d ago');
    expect(formatRelative(undefined, now)).toBe('never');
  });
  it('finds the start of the week for both week starts', () => {
    // 2026-09-27 is a Sunday.
    const sun = new Date(2026, 8, 27);
    expect(toIsoDate(startOfWeek(sun, 1))).toBe('2026-09-21');
    expect(toIsoDate(startOfWeek(sun, 7))).toBe('2026-09-27');
  });
});

describe('createFormatters', () => {
  it('binds the default currency', () => {
    const fmt = createFormatters({ ...DEFAULT_PREFERENCES, default_currency: 'GBP' });
    expect(fmt.money(10)).toBe('£10.00');
    expect(fmt.money(10, 'USD')).toBe('$10.00');
  });
});
