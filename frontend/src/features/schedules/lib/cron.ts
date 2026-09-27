/**
 * Cron presets and descriptions for schedules. The backend's cron parser numbers weekdays
 * 1 (Sunday) to 7 (Saturday), not 0 to 6, and runs every schedule in UTC.
 */
import { JobType } from '@/api/types';

export enum CronPresetId {
  Hourly = 'hourly',
  Daily = 'daily',
  Weekly = 'weekly',
  Monthly = 'monthly',
}

export interface CronPreset {
  id: CronPresetId;
  label: string;
  expr: string;
  description: string;
}

export const CRON_PRESETS: readonly CronPreset[] = [
  {
    id: CronPresetId.Hourly,
    label: 'Hourly',
    expr: '0 * * * *',
    description: 'Every hour, on the hour',
  },
  { id: CronPresetId.Daily, label: 'Daily', expr: '0 0 * * *', description: 'Daily at 00:00 UTC' },
  {
    id: CronPresetId.Weekly,
    label: 'Weekly',
    expr: '0 0 * * 1',
    description: 'Every Sunday at 00:00 UTC',
  },
  {
    id: CronPresetId.Monthly,
    label: 'Monthly',
    expr: '0 0 1 * *',
    description: 'Monthly on the 1st at 00:00 UTC',
  },
];

export const CRON_PLACEHOLDER = '30 6 * * 2';
export const CRON_HINT =
  'Five fields: minute, hour, day of month, month, weekday. Weekdays run 1 (Sunday) to 7 (Saturday). Times are UTC, at most once an hour.';

const norm = (expr: string) => expr.trim().split(/\s+/).join(' ');

export const presetFor = (expr: string): CronPreset | undefined =>
  CRON_PRESETS.find((p) => p.expr === norm(expr));

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_ABBR = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const pad = (n: number) => String(n).padStart(2, '0');
const isInt = (s: string, min: number, max: number) =>
  /^\d+$/.test(s) && Number(s) >= min && Number(s) <= max;

function ordinal(n: number): string {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

/** 1..7 or SUN..SAT to a weekday name (1 = Sunday). */
function weekday(field: string): string | null {
  const up = field.toUpperCase();
  const abbr = WEEKDAY_ABBR.indexOf(up);
  if (abbr >= 0) return WEEKDAYS[abbr];
  return isInt(field, 1, 7) ? WEEKDAYS[Number(field) - 1] : null;
}

/**
 * Plain words for the common shapes (hourly, daily, weekly on one day, monthly on one date);
 * null when the expression is anything else, so the caller can fall back to the server text.
 */
export function describeCron(expr: string): string | null {
  const parts = norm(expr).split(' ');
  if (parts.length !== 5) return null;
  const [min, hour, dom, month, dow] = parts;
  if (!isInt(min, 0, 59) || month !== '*') return null;
  if (hour === '*' && dom === '*' && dow === '*')
    return min === '0' ? 'Every hour, on the hour' : `Every hour at ${pad(Number(min))} past`;
  if (!isInt(hour, 0, 23)) return null;
  const at = `${pad(Number(hour))}:${pad(Number(min))} UTC`;
  if (dom === '*' && dow === '*') return `Daily at ${at}`;
  if (dom === '*') {
    const day = weekday(dow);
    return day ? `Every ${day} at ${at}` : null;
  }
  if (dow === '*' && isInt(dom, 1, 31)) return `Monthly on the ${ordinal(Number(dom))} at ${at}`;
  return null;
}

/** Client wording first (it says UTC and gets weekdays right), then the server's, then the raw text. */
export function cronLabel(expr: string, serverDescription?: string | null): string {
  return describeCron(expr) ?? (serverDescription?.trim() || expr);
}

/** Cheap client check before the server validates it properly. */
export function cronShapeError(expr: string): string | null {
  const parts = norm(expr).split(' ');
  if (!expr.trim()) return 'Enter a cron expression';
  if (parts.length !== 5) return 'Use five fields: minute hour day month weekday';
  if (parts[4].split(/[,-]/).includes('0'))
    return 'Weekdays run 1 (Sunday) to 7 (Saturday), so 0 is not valid';
  return null;
}

/** Job types a schedule can run, with the parameters each one takes. */
export const SCHEDULE_JOB_TYPES = [
  JobType.DRIFT_DETECTION,
  JobType.PORTFOLIO_SYNC,
  JobType.BANK_SYNC,
] as const;
export type ScheduleJobType = (typeof SCHEDULE_JOB_TYPES)[number];

export const LOOKBACK_DEFAULT = 7;
export const LOOKBACK_MIN = 1;
export const LOOKBACK_MAX = 365;

/** Human text for a schedule's parameters, keyed by job type. */
export function parameterLines(
  jobType: string,
  params: Record<string, unknown> | undefined,
  bankName?: (id: string) => string | undefined
): { label: string; value: string }[] {
  const p = params ?? {};
  if (jobType === (JobType.DRIFT_DETECTION as string)) {
    const days = typeof p.lookback_days === 'number' ? p.lookback_days : LOOKBACK_DEFAULT;
    return [{ label: 'Lookback', value: `${days} ${days === 1 ? 'day' : 'days'}` }];
  }
  if (jobType === (JobType.BANK_SYNC as string)) {
    const id = typeof p.bank_provider_id === 'string' ? p.bank_provider_id : '';
    return [{ label: 'Bank connection', value: id ? (bankName?.(id) ?? id) : 'Not set' }];
  }
  return [];
}

/** "in 5m", "in 3h", "in 2d"; "due" once the time has passed. */
export function timeUntil(iso: string, now: number = Date.now()): string {
  const ms = new Date(iso).getTime() - now;
  if (!Number.isFinite(ms)) return '';
  if (ms <= 0) return 'due';
  const m = Math.ceil(ms / 60_000);
  if (m < 60) return `in ${m}m`;
  const h = Math.round(m / 60);
  if (h < 48) return `in ${h}h`;
  return `in ${Math.round(h / 24)}d`;
}
