import { describe, expect, it } from 'vitest';
import {
  daysLeft,
  isSoon,
  PAGE_SIZE,
  pageAfterRemoval,
  pageParams,
  purgeLabel,
} from '@/features/trash/lib/trashModel';

const now = new Date('2026-09-27T12:00:00Z');

describe('trash', () => {
  it('counts whole days until the purge, never below zero', () => {
    expect(daysLeft({ permanent_delete_at: '2026-09-30T12:00:00Z' }, now)).toBe(3);
    expect(daysLeft({ permanent_delete_at: '2026-09-28T00:00:00Z' }, now)).toBe(1);
    expect(daysLeft({ permanent_delete_at: '2026-09-01T00:00:00Z' }, now)).toBe(0);
    expect(daysLeft({ permanent_delete_at: undefined }, now)).toBeNull();
    expect(daysLeft({ permanent_delete_at: 'garbage' }, now)).toBeNull();
  });

  it('labels and flags the purge', () => {
    expect(purgeLabel(1)).toBe('1 day left');
    expect(purgeLabel(12)).toBe('12 days left');
    expect(purgeLabel(0)).toBe('Removed at the next cleanup');
    expect(purgeLabel(null)).toBe('Kept until removed');
    expect(isSoon(3)).toBe(true);
    expect(isSoon(4)).toBe(false);
    expect(isSoon(null)).toBe(false);
  });

  it('pages by offset', () => {
    expect(pageParams(1)).toEqual({ limit: PAGE_SIZE, offset: 0 });
    expect(pageParams(3)).toEqual({ limit: PAGE_SIZE, offset: 2 * PAGE_SIZE });
    expect(pageParams(0).offset).toBe(0);
  });

  it('steps back a page when the last one empties', () => {
    expect(pageAfterRemoval(2, PAGE_SIZE + 1, 1)).toBe(1);
    expect(pageAfterRemoval(2, PAGE_SIZE + 5, 1)).toBe(2);
    expect(pageAfterRemoval(1, 1, 1)).toBe(1);
  });
});
