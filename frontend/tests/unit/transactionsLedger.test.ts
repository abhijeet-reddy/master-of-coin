import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AccountType, type Account, type Category, type Transaction } from '@/api/types';
import {
  byId,
  equalSplits,
  groupByDay,
  ledgerRow,
  splitPersonName,
  transferDelta,
  userShare,
  type LedgerContext,
} from '@/features/transactions/lib/ledger';

const saved = process.env.TZ;
process.env.TZ = 'Europe/London';
beforeAll(() => {
  process.env.TZ = 'Europe/London';
});
afterAll(() => {
  process.env.TZ = saved;
});

const acct = (id: string, currency: string): Account => ({
  id,
  name: `Acct ${id}`,
  account_type: AccountType.CHECKING,
  currency: currency as Account['currency'],
  balance: 0,
  is_active: true,
});
const cat = { id: 'c1', name: 'Groceries' } as Category;
let n = 0;
const tx = (p: Partial<Transaction>): Transaction => ({
  id: `t${++n}`,
  user_id: 'u',
  account_id: 'eur',
  title: 'Thing',
  amount: '-10.00',
  date: '2026-09-25T10:00:00Z',
  created_at: '',
  updated_at: '',
  ...p,
});
const ctx: LedgerContext = {
  accounts: byId([acct('eur', 'EUR'), acct('gbp', 'GBP'), acct('jpy', 'JPY')]),
  categories: byId([cat]),
  base: 'EUR',
  rates: { base: 'EUR', rates: { GBP: 0.8 } },
};

describe('groupByDay', () => {
  it('groups by local day in server order with a daily subtotal in the base currency', () => {
    const groups = groupByDay(
      [
        tx({ amount: '-12.50', date: '2026-09-25T18:00:00Z' }),
        tx({ amount: '100.00', date: '2026-09-25T08:00:00Z' }),
        tx({ amount: '-8.00', account_id: 'gbp', date: '2026-09-24T12:00:00Z' }),
        tx({ amount: '-2.25', date: '2026-09-24T09:00:00Z' }),
      ],
      ctx
    );
    expect(groups.map((g) => g.day)).toEqual(['2026-09-25', '2026-09-24']);
    expect(groups[0].rows).toHaveLength(2);
    expect(groups[0].subtotal).toBe(87.5);
    // 8 GBP at 0.8 GBP per EUR = 10 EUR.
    expect(groups[1].subtotal).toBe(-12.25);
    expect(groups[1].missing).toEqual([]);
  });

  it('puts a just-after-midnight BST entry on its local day', () => {
    const [g] = groupByDay([tx({ date: '2026-09-25T23:30:00Z' })], ctx);
    expect(g.day).toBe('2026-09-26');
  });

  it('flags a partial subtotal when a currency has no rate', () => {
    const [g] = groupByDay([tx({ amount: '-5' }), tx({ amount: '-1000', account_id: 'jpy' })], ctx);
    expect(g.subtotal).toBe(-5);
    expect(g.missing).toEqual(['JPY']);
  });
});

describe('ledgerRow', () => {
  it('converts only non-base currencies and resolves category and account', () => {
    const eur = ledgerRow(tx({ category_id: 'c1' }), ctx);
    expect(eur.converted).toBeNull();
    expect(eur.category?.name).toBe('Groceries');
    expect(eur.accountName).toBe('Acct eur');
    const gbp = ledgerRow(tx({ account_id: 'gbp', amount: '-8' }), ctx);
    expect(gbp.currency).toBe('GBP');
    expect(gbp.converted).toBeCloseTo(-10);
  });

  it('describes splits, transfers and paid-by-others rows', () => {
    const r = ledgerRow(
      tx({
        amount: '-30',
        notes: ' dinner ',
        splits: [
          { id: 's1', person_id: 'p1', person_name: 'Sam', amount: '10' },
          { id: 's2', person_id: 'p2', person_name: 'Ana', amount: '10' },
        ] as Transaction['splits'],
        transfer_info: {
          transfer_id: 'x',
          linked_account_id: 'gbp',
          linked_account_name: 'Savings',
          linked_amount: '30',
        },
      }),
      ctx
    );
    expect(r.split).toEqual({ name: 'Sam', count: 2, othersTotal: 20 });
    expect(r.transfer).toEqual({ direction: 'to', account: 'Savings' });
    expect(r.hasNote).toBe(true);
    const debt = ledgerRow(
      tx({
        debt_metadata: {
          payer_person_id: 'p1',
          payer_person_name: 'Sam',
        } as Transaction['debt_metadata'],
      }),
      ctx
    );
    expect(debt.paidBy).toBe('Sam');
    expect(debt.accountName).toBe('Paid by Sam');
  });
});

describe('split maths', () => {
  it('your share is the amount less the others, floored at zero', () => {
    expect(userShare(-30, ['10', '10'])).toBe(10);
    expect(userShare(-10, ['8', '8'])).toBe(0);
  });
  it('equal splits hand remainder pennies to the others, deterministically', () => {
    expect(equalSplits(10, 2)).toEqual(['3.34', '3.33']);
    expect(equalSplits(9, 2)).toEqual(['3.00', '3.00']);
    expect(equalSplits(0, 2)).toEqual(['0.00', '0.00']);
    expect(equalSplits(10, 0)).toEqual([]);
  });
});

describe('transferDelta', () => {
  it('is null when legs match to the cent and signed otherwise', () => {
    expect(transferDelta('-100.00', '100.00')).toBeNull();
    expect(transferDelta('-100.00', '95.00')).toBe(5);
    expect(transferDelta('-95.00', '100.00')).toBe(-5);
  });
});

describe('splitPersonName', () => {
  const people = new Map([['p1', { name: 'Maya' }]]);
  it('resolves names from the people list when the API sends only person_id', () => {
    expect(splitPersonName({ person_id: 'p1' }, people)).toBe('Maya');
  });
  it('prefers a name the API sent, and falls back when the person is unknown', () => {
    expect(splitPersonName({ person_id: 'p1', person_name: 'Sam' }, people)).toBe('Sam');
    expect(splitPersonName({ person_id: 'zz' }, people)).toBe('Someone');
  });
});
