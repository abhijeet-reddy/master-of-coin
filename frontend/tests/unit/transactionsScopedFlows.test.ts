import { describe, expect, it } from 'vitest';
import type { Account } from '@/api/types';
import { scopedFlows } from '@/features/transactions/lib/ledger';

const accounts = new Map(
  [
    ['gbp', 'GBP'],
    ['usd', 'USD'],
    ['jpy', 'JPY'],
  ].map(([id, currency]) => [id, { id, currency } as unknown as Account])
);
const ctx = { accounts, base: 'GBP', rates: { base: 'GBP', rates: { USD: 1.25 } } };

describe('scopedFlows', () => {
  it('converts every row into the default currency', () => {
    const f = scopedFlows(
      [
        { account_id: 'gbp', amount: '100' },
        { account_id: 'usd', amount: '-25' },
        { account_id: 'gbp', amount: '-10.56' },
      ],
      ctx
    );
    expect(f).toEqual({ in: 100, out: -30.56, net: 69.44, count: 3, missing: [] });
  });

  it('leaves out rows with no rate and names the currency', () => {
    const f = scopedFlows(
      [
        { account_id: 'gbp', amount: '5' },
        { account_id: 'jpy', amount: '-1000' },
      ],
      ctx
    );
    expect(f.net).toBe(5);
    expect(f.missing).toEqual(['JPY']);
  });

  it('treats unknown accounts as the default currency', () => {
    expect(scopedFlows([{ account_id: 'gone', amount: '-3' }], ctx).out).toBe(-3);
  });
});
