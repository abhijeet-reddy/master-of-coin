import { describe, expect, it } from 'vitest';
import {
  spendStats,
  TINY_AVERAGE,
  vsAverageLabel,
} from '@/features/categories/lib/categoriesModel';

describe('vsAverageLabel', () => {
  it('shows a signed percentage in the normal range', () => {
    expect(vsAverageLabel(150, 100)).toBe('+50% vs average');
    expect(vsAverageLabel(50, 100)).toBe('-50% vs average');
    expect(vsAverageLabel(100, 100)).toBe('0% vs average');
    expect(vsAverageLabel(1099, 100)).toBe('+999% vs average');
  });

  it('caps huge percentages', () => {
    expect(vsAverageLabel(1100, 100)).toBe('Over 999% vs average');
    expect(vsAverageLabel(5000, 2)).toBe('Over 999% vs average');
  });

  it('says new when the average is zero or tiny', () => {
    expect(vsAverageLabel(80, 0)).toBe('New vs average');
    expect(vsAverageLabel(80, TINY_AVERAGE - 0.01)).toBe('New vs average');
    expect(vsAverageLabel(0, 0)).toBe('No earlier spend');
  });

  it('gets the earlier average from spendStats', () => {
    const s = spendStats([
      { month: '2026-07', total: 10 },
      { month: '2026-08', total: 30 },
      { month: '2026-09', total: 60 },
    ] as Parameters<typeof spendStats>[0]);
    expect(s.earlierAverage).toBe(20);
    expect(vsAverageLabel(s.thisMonth, s.earlierAverage)).toBe('+200% vs average');
  });
});
