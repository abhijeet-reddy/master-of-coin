/** Pure helpers for background jobs: route types, labels, status, timing, summaries, paging. */
import { JobStatus, JobType, type BackgroundJobSummary } from '@/api/types';
import { Tone } from '@/ui/types';

/** The `:type` segment of `/jobs/:type/:id` for each job type. */
export const JOB_ROUTE: Record<JobType, string> = {
  [JobType.DRIFT_DETECTION]: 'drift-detection',
  [JobType.BULK_SYNC]: 'sync',
  [JobType.PORTFOLIO_SYNC]: 'portfolio-sync',
  [JobType.BANK_SYNC]: 'bank-sync',
};

export const JOB_TYPE_LABEL: Record<JobType, string> = {
  [JobType.DRIFT_DETECTION]: 'Drift Detection',
  [JobType.BULK_SYNC]: 'Bulk Sync',
  [JobType.PORTFOLIO_SYNC]: 'Portfolio Sync',
  [JobType.BANK_SYNC]: 'Bank Sync',
};

export const JOB_TYPES = Object.values(JobType);

export const jobTypeLabel = (t: string): string => JOB_TYPE_LABEL[t as JobType] ?? t;

/** `drift-detection` to DRIFT_DETECTION; null for anything unknown. */
export function jobTypeFromRoute(segment: string | undefined): JobType | null {
  const hit = (Object.entries(JOB_ROUTE) as [JobType, string][]).find(([, s]) => s === segment);
  return hit ? hit[0] : null;
}

export const jobPath = (job: Pick<BackgroundJobSummary, 'id' | 'job_type'>): string =>
  `/jobs/${JOB_ROUTE[job.job_type] ?? 'unknown'}/${job.id}`;

export const isJobActive = (status: string | undefined): boolean =>
  status === JobStatus.PENDING || status === JobStatus.RUNNING;

const STATUS: Record<JobStatus, { label: string; tone: Tone }> = {
  [JobStatus.PENDING]: { label: 'Queued', tone: Tone.Neutral },
  [JobStatus.RUNNING]: { label: 'Running', tone: Tone.Accent },
  [JobStatus.COMPLETED]: { label: 'Completed', tone: Tone.Pos },
  [JobStatus.FAILED]: { label: 'Failed', tone: Tone.Crit },
};

export function jobStatus(status: string): { label: string; tone: Tone } {
  return STATUS[status as JobStatus] ?? { label: status, tone: Tone.Neutral };
}

/** Milliseconds between two timestamps; null when either is missing or the range is invalid. */
export function durationMs(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
}

/** `850ms`, `4.2s`, `3m 5s`, `2h 4m`. */
export function formatDuration(ms: number | null): string {
  if (ms === null) return '--';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const totalS = Math.round(s);
  const m = Math.floor(totalS / 60);
  if (m < 60) return `${m}m ${totalS % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** One line for the list: "12 synced, 3 drifted", "4/5 ok", "Error: ...". */
export function jobSummaryText(
  job: Pick<BackgroundJobSummary, 'job_type' | 'error' | 'summary' | 'status'>
): string {
  if (job.error) {
    const e = job.error.trim();
    return `Error: ${e.length > 60 ? `${e.slice(0, 59).trimEnd()}...` : e}`;
  }
  const s = job.summary;
  if (!s) return isJobActive(job.status) ? 'In progress' : '';
  switch (job.job_type) {
    case JobType.DRIFT_DETECTION:
      return `${num(s.synced)} synced, ${num(s.drifted)} drifted`;
    case JobType.BULK_SYNC:
      return `${num(s.succeeded)}/${num(s.total)} ok`;
    case JobType.BANK_SYNC:
      return `${num(s.total_fetched)} fetched, ${num(s.new_transactions)} new`;
    default:
      return '';
  }
}

export const JOBS_PAGE_SIZE = 25;

/** The list has no total: fetch one extra row to know whether a next page exists. */
export function jobListParams(page: number, jobType?: JobType) {
  return {
    ...(jobType ? { job_type: jobType } : {}),
    limit: JOBS_PAGE_SIZE + 1,
    offset: (Math.max(1, Math.floor(page)) - 1) * JOBS_PAGE_SIZE,
  };
}

export function pageOf<T>(rows: readonly T[]): { rows: T[]; hasNext: boolean } {
  return { rows: rows.slice(0, JOBS_PAGE_SIZE), hasNext: rows.length > JOBS_PAGE_SIZE };
}

/** A best-effort pretty print of a job's input or result. */
export function prettyJson(v: unknown): string {
  if (v === null || v === undefined) return '';
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return typeof v === 'string' ? v : '';
  }
}

// ---------- bulk sync results ----------

const SKIPPED = new Set(['not_applicable', 'already_linked']);

const detailKey = (d: Record<string, unknown> | undefined): string | undefined => {
  const v = d?.sync_status ?? d?.status;
  return typeof v === 'string' ? v : undefined;
};

/** What happened to one sync item, in words. */
export function syncItemDetail(item: { error?: string; detail?: Record<string, unknown> }): string {
  if (item.error) return item.error;
  const d = item.detail;
  if (!d) return '';
  const message = typeof d.message === 'string' ? d.message : undefined;
  const ext = typeof d.external_expense_id === 'string' ? d.external_expense_id : undefined;
  switch (detailKey(d)) {
    case 'created':
      return ext ? `Created on the provider (#${ext})` : 'Created on the provider';
    case 'synced':
      return 'Already in sync';
    case 'linked':
      return 'Linked to an existing expense';
    case 'imported':
      return 'Imported as a local transaction';
    case 'not_applicable':
      return message ?? 'Skipped, nothing to sync';
    case 'already_linked':
      return message ?? 'Already linked, nothing done';
    case 'pushed':
      return message ?? 'Pushed to the provider';
    case 'pulled':
      return message ?? 'Updated from the provider';
    default:
      return message ?? '';
  }
}

export enum SyncOutcome {
  Done = 'done',
  Skipped = 'skipped',
  Failed = 'failed',
}

export function syncItemOutcome(item: {
  status: string;
  error?: string;
  detail?: Record<string, unknown>;
}): SyncOutcome {
  if (item.error || item.status !== 'success') return SyncOutcome.Failed;
  const k = detailKey(item.detail);
  return k && SKIPPED.has(k) ? SyncOutcome.Skipped : SyncOutcome.Done;
}

// ---------- input ----------

export interface InputEntry {
  key: string;
  label: string;
  value: unknown;
}

const LABELS: Record<string, string> = {
  schedule_id: 'Schedule',
  bank_provider_id: 'Bank connection',
  account_id: 'Account',
  start_date: 'From',
  end_date: 'To',
  from_date: 'From',
  to_date: 'To',
  lookback_days: 'Lookback days',
  items: 'Items',
};

export const humanizeKey = (k: string): string =>
  LABELS[k] ?? (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, ' ');

/** A job's input as label and value pairs; nested values are left for the raw view. */
export function inputEntries(input: Record<string, unknown> | null | undefined): InputEntry[] {
  if (!input || typeof input !== 'object') return [];
  // The server stores input as a JSON map (keys come back alphabetical); show
  // ranges as From then To, and everything else after in a stable order.
  const rank = (k: string) => {
    const i = KEY_ORDER.indexOf(k);
    return i === -1 ? KEY_ORDER.length : i;
  };
  return Object.entries(input)
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([key, value]) => ({ key, label: humanizeKey(key), value }));
}

const KEY_ORDER = ['start_date', 'from_date', 'end_date', 'to_date', 'lookback_days'];
