import { describe, expect, it } from 'vitest';
import {
  AccountType,
  BudgetHealth,
  type Account,
  type DashboardBudgetStatus,
  type Person,
} from '@/api/types';
import {
  activityRows,
  balanceSheet,
  budgetRows,
  categoryShares,
  debtRows,
  fxPairs,
  isQuietSeries,
  monthlyStats,
  netWorthDelta,
  periodElapsed,
  providerLinks,
  ProviderKind,
  topSpend,
} from '@/features/dashboard/lib/dashboardModel';

const acct = (id: string, type: AccountType, currency = 'EUR'): Account => ({
  id,
  name: `Acct ${id}`,
  account_type: type,
  currency: currency as Account['currency'],
  balance: 0,
  is_active: true,
});

describe('balanceSheet', () => {
  it('splits assets and liabilities, orders assets first and counts accounts', () => {
    const sheet = balanceSheet(
      { CREDIT_CARD: '-300.00', CHECKING: '1000.00', SAVINGS: '500.00', CASH: '0' },
      [
        acct('a', AccountType.CHECKING),
        acct('b', AccountType.CHECKING),
        acct('c', AccountType.CREDIT_CARD),
        acct('d', AccountType.SAVINGS),
      ]
    );
    expect(sheet.rows.map((r) => r.type)).toEqual(['CHECKING', 'SAVINGS', 'CREDIT_CARD']);
    expect(sheet.rows[0].count).toBe(2);
    expect(sheet.rows[2].liability).toBe(true);
    expect(sheet.assets).toBe(1500);
    expect(sheet.liabilities).toBe(-300);
    expect(sheet.net).toBe(1200);
    expect(sheet.assetShare).toBeCloseTo(1500 / 1800);
  });

  it('treats a negative asset type as a liability and survives no data', () => {
    expect(balanceSheet({ CHECKING: '-20' }, []).rows[0].liability).toBe(true);
    expect(balanceSheet(undefined, [])).toMatchObject({
      rows: [],
      assets: 0,
      liabilities: 0,
      assetShare: 0,
    });
  });
});

describe('netWorthDelta', () => {
  it('compares the first point with the latest', () => {
    const d = netWorthDelta([
      { date: '2025-10-01', total: '1000', by_type: {} },
      { date: '2026-09-27', total: '1250', by_type: {} },
    ]);
    expect(d).toEqual({ change: 250, percent: 25, since: '2025-10-01' });
  });
  it('has no percent from zero and no delta from one point', () => {
    expect(
      netWorthDelta([
        { date: 'a', total: '0', by_type: {} },
        { date: 'b', total: '5', by_type: {} },
      ])?.percent
    ).toBeNull();
    expect(netWorthDelta([{ date: 'a', total: '5', by_type: {} }])).toBeNull();
  });
});

describe('monthlyStats', () => {
  const series = [
    { month: '2026-08', income: '1000', spend: '600', net: '400' },
    { month: '2026-09', income: '2000', spend: '1500', net: '500' },
  ];
  it('reads the last month as current, averages spend and computes savings rate', () => {
    const s = monthlyStats(series);
    expect(s.current).toEqual({ month: '2026-09', income: 2000, spend: 1500, net: 500 });
    expect(s.avgSpend).toBe(1050);
    expect(s.savingsRate).toBe(25);
    expect(isQuietSeries(s)).toBe(false);
  });
  it('has no savings rate without income, and an empty series is quiet', () => {
    expect(
      monthlyStats([{ month: '2026-09', income: '0', spend: '10', net: '-10' }]).savingsRate
    ).toBeNull();
    const empty = monthlyStats([]);
    expect(empty.current).toBeNull();
    expect(isQuietSeries(empty)).toBe(true);
  });
});

describe('periodElapsed', () => {
  it('counts inclusive days through today', () => {
    expect(periodElapsed('2026-09-01', '2026-09-30', new Date(2026, 8, 15, 18))).toBe(50);
    expect(periodElapsed('2026-09-01', '2026-09-30', new Date(2026, 9, 5))).toBe(100);
    expect(periodElapsed('2026-09-01', '2026-09-30', new Date(2026, 7, 5))).toBe(0);
    expect(periodElapsed('bad', '2026-09-30', new Date())).toBeNull();
  });
});

describe('budgetRows', () => {
  const status = (id: string, pct: number): DashboardBudgetStatus => ({
    budget_id: id,
    name: id,
    current_spending: '1',
    limit_amount: '2',
    remaining: '1',
    percentage_used: pct,
    is_over_budget: pct > 100,
    status: pct > 100 ? BudgetHealth.Over : BudgetHealth.OnTrack,
    period: 'MONTHLY',
    period_start: '2026-09-01',
    period_end: '2026-09-30',
    days_left: 3,
    currency: 'EUR',
  });
  it('sorts by usage and keeps the top four', () => {
    const rows = budgetRows(
      [status('a', 10), status('b', 120), status('c', 50), status('d', 90), status('e', 5)],
      new Date(2026, 8, 15)
    );
    expect(rows.map((r) => r.id)).toEqual(['b', 'd', 'c', 'a']);
    expect(rows[0].health).toBe(BudgetHealth.Over);
    expect(rows[0].pace).toBe(50);
  });
});

describe('categories', () => {
  const items = [
    { category_id: 'r', category_name: 'Rent', total: '600', percentage: 60 },
    { category_name: undefined, total: '100', percentage: 10 },
    { category_id: 'g', category_name: 'Groceries', total: '300', percentage: 30 },
  ];
  it('folds shares and names the uncategorised bucket', () => {
    const s = categoryShares(items);
    expect(s.total).toBe(1000);
    expect(s.slices.map((x) => x.label)).toEqual(['Rent', 'Groceries', 'Uncategorised']);
  });
  it('ranks top spend with bars relative to the largest', () => {
    const rows = topSpend(items, 2);
    expect(rows.map((r) => r.label)).toEqual(['Rent', 'Groceries']);
    expect(rows[1].width).toBeCloseTo(0.5);
    expect(rows[0].percent).toBe(60);
  });
});

describe('debtRows', () => {
  const person = (id: string, net: string): Person => ({
    id,
    name: id,
    transaction_count: 1,
    created_at: '',
    debt_summary: { owes_me: '0', i_owe: '0', net },
  });
  it('falls back to the server net without a converted balance', () => {
    const rows = debtRows([
      person('a', '10'),
      person('b', '0.00'),
      person('c', '-40'),
      { ...person('d', '0'), debt_summary: undefined },
    ]);
    expect(rows.map((r) => r.id)).toEqual(['c', 'a']);
    expect(rows[1].width).toBeCloseTo(0.25);
  });
});

describe('providerLinks and fxPairs', () => {
  const accounts = [
    acct('a1', AccountType.CHECKING),
    acct('a2', AccountType.INVESTMENT, 'GBP'),
    acct('a3', AccountType.CHECKING, 'USD'),
  ];
  it('joins active providers to their accounts', () => {
    const links = providerLinks(
      [
        { id: 'b1', account_id: 'a1', is_active: true, last_sync_at: '2026-09-27T10:00:00Z' },
        { id: 'b2', account_id: 'gone', is_active: true },
      ],
      [
        { id: 'i1', account_id: 'a2', is_active: true },
        { id: 'i2', account_id: 'a3', is_active: false },
      ],
      accounts,
      { bank: 'TrueLayer', investment: 'Trading 212' }
    );
    expect(links.map((l) => [l.id, l.kind, l.accountName])).toEqual([
      ['b1', ProviderKind.Bank, 'Acct a1'],
      ['i1', ProviderKind.Investment, 'Acct a2'],
    ]);
    expect(links[1].lastSyncAt).toBeNull();
  });
  it('lists foreign currencies with the rate into the base', () => {
    expect(fxPairs(accounts, 'EUR', { GBP: 0.8, USD: 0 })).toEqual([
      { code: 'GBP', rate: 1.25 },
      { code: 'USD', rate: null },
    ]);
  });
});

describe('activityRows', () => {
  it('joins account and category and flags splits, transfers and notes', () => {
    const [row] = activityRows(
      [
        {
          id: 't',
          user_id: 'u',
          account_id: 'a1',
          category_id: 'c',
          title: 'Dinner',
          amount: '-40',
          date: '2026-09-25',
          notes: ' ',
          splits: [{ id: 's', person_id: 'p', person_name: 'Ana', amount: '20' }],
          created_at: '',
          updated_at: '',
        },
      ],
      [acct('a1', AccountType.CHECKING, 'GBP')],
      [{ id: 'c', name: 'Dining', icon: '', color: '#fff', created_at: '' }]
    );
    expect(row).toMatchObject({
      currency: 'GBP',
      accountName: 'Acct a1',
      categoryName: 'Dining',
      split: { name: 'Ana', count: 1 },
      hasNote: false,
      transferTo: null,
    });
  });
});
