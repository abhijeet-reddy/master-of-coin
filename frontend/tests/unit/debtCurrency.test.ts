import { describe, expect, it } from 'vitest';
import type { Person, Transaction } from '@/api/types';
import { balanceOf, debtTotals, netsByCurrency, withBalances } from '@/lib/debtCurrency';
import { debtRows } from '@/features/dashboard/lib/dashboardModel';
import { peopleTotals, personNet } from '@/features/people/lib/peopleModel';

// 1 GBP buys 1.25 USD and 1.2 EUR.
const table = { base: 'GBP', rates: { USD: 1.25, EUR: 1.2 } };
const currency: Record<string, string> = { gbp: 'GBP', usd: 'USD', eur: 'EUR' };
const tx = (account: string, splits: [string, string][]) =>
  ({
    account_id: account,
    splits: splits.map(([person_id, amount]) => ({ person_id, amount })),
  }) as unknown as Transaction;

describe('netsByCurrency', () => {
  it('groups split totals by the account currency', () => {
    const nets = netsByCurrency(
      [
        tx('gbp', [['p1', '10']]),
        tx('usd', [
          ['p1', '25'],
          ['p2', '-5'],
        ]),
        tx('usd', [['p1', '5']]),
        tx('unknown', [['p1', '999']]),
      ],
      (id) => currency[id]
    );
    expect([...nets.get('p1')!]).toEqual([
      ['GBP', 10],
      ['USD', 30],
    ]);
    expect([...nets.get('p2')!]).toEqual([['USD', -5]]);
  });
});

describe('balanceOf', () => {
  it('converts each currency instead of adding them raw', () => {
    // The server says 40: 10 GBP + 30 USD added as if one currency.
    const b = balanceOf(
      40,
      new Map([
        ['GBP', 10],
        ['USD', 30],
      ]),
      'GBP',
      table
    );
    expect(b.net).toBe(34); // 10 + 30 / 1.25
    expect(b.natives).toEqual([
      { currency: 'USD', amount: 30 },
      { currency: 'GBP', amount: 10 },
    ]);
    expect(b.foreign).toBe(true);
    expect(b.missing).toEqual([]);
  });

  it('gives exactly the server figure when everything is in the default currency', () => {
    const b = balanceOf('12.34', new Map([['GBP', 12.34]]), 'GBP', null);
    expect(b).toEqual({
      net: 12.34,
      natives: [{ currency: 'GBP', amount: 12.34 }],
      missing: [],
      foreign: false,
    });
    // Splits beyond the loaded page are assumed to be in the default currency.
    expect(balanceOf(50, new Map([['GBP', 20]]), 'GBP', null).net).toBe(50);
    expect(balanceOf(-7, undefined, 'GBP', null).net).toBe(-7);
  });

  it('leaves out currencies with no rate and lists them', () => {
    const b = balanceOf(
      15,
      new Map([
        ['GBP', 5],
        ['JPY', 10],
      ]),
      'GBP',
      table
    );
    expect(b.net).toBe(5);
    expect(b.missing).toEqual(['JPY']);
  });

  it('drops currencies that net to zero', () => {
    const b = balanceOf(
      0,
      new Map([
        ['GBP', 0],
        ['USD', 0.001],
      ]),
      'GBP',
      table
    );
    expect(b.natives).toEqual([]);
    expect(b.foreign).toBe(false);
  });
});

describe('withBalances', () => {
  it('feeds the converted net into totals and the per-person net', () => {
    const people = [
      { id: 'p1', name: 'Ann', debt_summary: { net: '40', owes_me: '40', i_owe: '0' } },
      { id: 'p2', name: 'Bo', debt_summary: { net: '-6', owes_me: '0', i_owe: '6' } },
    ] as unknown as Person[];
    const nets = new Map([
      [
        'p1',
        new Map([
          ['GBP', 10],
          ['USD', 30],
        ]),
      ],
      ['p2', new Map([['EUR', -6]])],
    ]);
    const list = withBalances(people, nets, 'GBP', table);
    expect(personNet(list[0]).net).toBe(34);
    expect(personNet(list[1]).net).toBe(-5);
    expect(peopleTotals(list)).toMatchObject({ owedToMe: 34, iOwe: 5, net: 29, open: 2 });
  });
});

describe('debtTotals and debtRows (dashboard, status strip)', () => {
  const people = [
    { id: 'p1', name: 'Ann', debt_summary: { net: '40', owes_me: '40', i_owe: '0' } },
    { id: 'p2', name: 'Bo', debt_summary: { net: '-6', owes_me: '0', i_owe: '6' } },
    { id: 'p3', name: 'Cy', debt_summary: { net: '7', owes_me: '7', i_owe: '0' } },
  ] as unknown as Person[];
  const nets = new Map([
    [
      'p1',
      new Map([
        ['GBP', 10],
        ['USD', 30],
      ]),
    ],
    ['p2', new Map([['EUR', -6]])],
    ['p3', new Map([['JPY', 7]])],
  ]);
  const list = withBalances(people, nets, 'GBP', table);

  it('sums converted balances, not the raw server figures', () => {
    // Raw: 40 + 7 owed to me. Converted: 34, and JPY has no rate so it is left out.
    expect(debtTotals(list.map((p) => p.balance))).toEqual({
      owedToMe: 34,
      iOwe: 5,
      missing: ['JPY'],
    });
  });

  it('ranks dashboard rows by the converted balance', () => {
    const rows = debtRows(list);
    expect(rows.map((r) => [r.id, r.net])).toEqual([
      ['p1', 34],
      ['p2', -5],
    ]);
  });
});
