/**
 * Transaction date and time are entered, shown and stored in the user's LOCAL
 * time zone. (v1 built `${date}T${time}:00Z`, which shifted every entry by the
 * UTC offset.) The server stores an instant, so we send an ISO instant built
 * from the local wall clock.
 */
import { toIsoDate } from '@/lib/format';

const pad = (n: number) => String(n).padStart(2, '0');
const TIME_RE = /^(\d{2}):(\d{2})$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A local date and time as a Date, or null when either part is malformed. */
export function localDateTime(date: string, time: string): Date | null {
  const d = DATE_RE.exec(date);
  const t = TIME_RE.exec(time || '00:00');
  if (!d || !t) return null;
  const out = new Date(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));
  return Number.isNaN(out.getTime()) ? null : out;
}

/** `2026-09-25` + `19:30` (local) as the UTC instant the API stores. */
export function toApiDateTime(date: string, time: string): string {
  const d = localDateTime(date, time);
  if (!d) throw new Error(`Invalid date or time: ${date} ${time}`);
  return d.toISOString();
}

/** A stored instant as the local `YYYY-MM-DD` and `HH:MM` the form shows. */
export function fromApiDateTime(value: string): { date: string; time: string } {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return nowParts();
  return { date: toIsoDate(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

export function nowParts(now: Date = new Date()): { date: string; time: string } {
  return { date: toIsoDate(now), time: `${pad(now.getHours())}:${pad(now.getMinutes())}` };
}

/** True when the local date and time is later than now (to the minute). */
export function isFuture(date: string, time: string, now: Date = new Date()): boolean {
  const d = localDateTime(date, time);
  if (!d) return false;
  const minute = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
    now.getMinutes()
  );
  return d.getTime() > minute.getTime();
}

/** The local calendar day of a stored instant (what the ledger groups by). */
export function localDay(value: string): string {
  if (DATE_RE.test(value)) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value.slice(0, 10) : toIsoDate(d);
}
