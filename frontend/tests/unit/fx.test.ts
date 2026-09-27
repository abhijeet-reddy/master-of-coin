import { describe, expect, it } from 'vitest';
import { convert, rateBetween, sumConverted, type RateTable } from '@/lib/fx';

const table: RateTable = { base: 'EUR', rates: { USD: 1.1, GBP: 0.85, INR: 92 } };

describe('fx', () => {
  it('returns 1 for the same currency, even without a table', () => {
    expect(rateBetween('EUR', 'EUR', null)).toBe(1);
  });
  it('converts through the base', () => {
    expect(rateBetween('EUR', 'USD', table)).toBeCloseTo(1.1);
    expect(rateBetween('USD', 'EUR', table)).toBeCloseTo(1 / 1.1);
    expect(convert('100', 'GBP', 'USD', table)).toBeCloseTo((100 * 1.1) / 0.85);
  });
  it('returns null rather than 0 when a rate is missing', () => {
    expect(rateBetween('EUR', 'JPY', table)).toBeNull();
    expect(convert(10, 'EUR', 'USD', null)).toBeNull();
  });
  it('sums mixed currencies and lists the missing ones', () => {
    const { total, missing } = sumConverted(
      [
        { amount: '100', currency: 'EUR' },
        { amount: '110', currency: 'USD' },
        { amount: '5', currency: 'JPY' },
      ],
      'EUR',
      table
    );
    expect(total).toBeCloseTo(200);
    expect(missing).toEqual(['JPY']);
  });
});
