import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  fromApiDateTime,
  isFuture,
  localDateTime,
  localDay,
  nowParts,
  toApiDateTime,
} from '@/features/transactions/lib/datetime';
import { dateWindow } from '@/features/transactions/lib/filters';

// Node honours TZ changes at runtime; pin a zone well away from UTC.
const saved = process.env.TZ;
process.env.TZ = 'America/Los_Angeles';
beforeAll(() => {
  process.env.TZ = 'America/Los_Angeles';
});
afterAll(() => {
  process.env.TZ = saved;
});

describe('transaction date and time are local', () => {
  it('sends the local wall clock as the matching UTC instant, not as UTC', () => {
    // 19:30 in Los Angeles (PDT, UTC-7) is 02:30 UTC the next day.
    expect(toApiDateTime('2026-09-25', '19:30')).toBe('2026-09-26T02:30:00.000Z');
  });

  it('shows a stored instant as the local date and time', () => {
    expect(fromApiDateTime('2026-09-26T02:30:00.000Z')).toEqual({
      date: '2026-09-25',
      time: '19:30',
    });
  });

  it('round trips through the API without drifting', () => {
    const iso = toApiDateTime('2026-01-15', '08:05');
    expect(fromApiDateTime(iso)).toEqual({ date: '2026-01-15', time: '08:05' });
  });

  it('groups a late evening entry under its local day', () => {
    expect(localDay('2026-09-26T02:30:00.000Z')).toBe('2026-09-25');
    expect(localDay('2026-09-25')).toBe('2026-09-25');
  });

  it('rejects malformed parts', () => {
    expect(localDateTime('25/09/2026', '10:00')).toBeNull();
    expect(localDateTime('2026-09-25', '7pm')).toBeNull();
    expect(() => toApiDateTime('nope', '10:00')).toThrow();
  });

  it('compares the future to the minute in local time', () => {
    const now = new Date(2026, 8, 25, 19, 30, 40);
    expect(nowParts(now)).toEqual({ date: '2026-09-25', time: '19:30' });
    expect(isFuture('2026-09-25', '19:30', now)).toBe(false);
    expect(isFuture('2026-09-25', '19:31', now)).toBe(true);
  });

  it('builds the month window from local midnight', () => {
    const w = dateWindow({ month: '2026-09', from: undefined, to: undefined });
    expect(w.start_date).toBe('2026-09-01T07:00:00.000Z');
    expect(w.end_date).toBe('2026-10-01T06:59:59.999Z');
  });

  it('makes an explicit To date inclusive of the whole local day', () => {
    const w = dateWindow({ month: '', from: '2026-09-10', to: '2026-09-12' });
    expect(w.start_date).toBe('2026-09-10T07:00:00.000Z');
    expect(w.end_date).toBe('2026-09-13T06:59:59.999Z');
  });
});
