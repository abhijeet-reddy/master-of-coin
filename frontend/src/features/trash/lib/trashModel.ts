/** Pure helpers for the trash page: when each row is purged, and paging. */
import type { Transaction } from '@/api/types';

const DAY = 86_400_000;
/** At or under this many days left, the row is flagged. */
export const SOON_DAYS = 3;

/** Whole days until the row is removed for good; 0 when due. null when the server gave no date. */
export function daysLeft(
  tx: Pick<Transaction, 'permanent_delete_at'>,
  now: Date = new Date()
): number | null {
  if (!tx.permanent_delete_at) return null;
  const at = new Date(tx.permanent_delete_at).getTime();
  if (Number.isNaN(at)) return null;
  return Math.max(0, Math.ceil((at - now.getTime()) / DAY));
}

export function purgeLabel(days: number | null): string {
  if (days === null) return 'Kept until removed';
  if (days === 0) return 'Removed at the next cleanup';
  return days === 1 ? '1 day left' : `${days} days left`;
}

export const isSoon = (days: number | null) => days !== null && days <= SOON_DAYS;

export const PAGE_SIZE = 50;

export const pageParams = (page: number) => ({
  limit: PAGE_SIZE,
  offset: (Math.max(1, page) - 1) * PAGE_SIZE,
});

/** After removing `removed` rows, the last page may be empty: step back to the new last page. */
export function pageAfterRemoval(page: number, total: number, removed: number): number {
  const left = Math.max(0, total - removed);
  const last = Math.max(1, Math.ceil(left / PAGE_SIZE));
  return Math.min(page, last);
}
