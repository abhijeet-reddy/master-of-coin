import { describe, expect, it } from 'vitest';
import type { Category, Transaction } from '@/api/types';
import {
  buildCategoryRequest,
  categoryDefaults,
  categorySchema,
  PALETTE,
  pickColor,
} from '@/features/categories/forms/categoryForm';
import {
  lastMonths,
  monthlySpend,
  monthsWindow,
  monthTick,
  searchCategories,
  sortCategories,
  spendByCategory,
  spendStats,
  type SpendContext,
} from '@/features/categories/lib/categoriesModel';

const cat = (over: Partial<Category> = {}): Category => ({
  id: 'c1',
  name: 'Groceries',
  icon: '🛒',
  color: '#3987E5',
  is_excluded_from_analysis: false,
  ...over,
});

const tx = (over: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36).slice(2),
  user_id: 'u',
  account_id: 'eur',
  title: 't',
  amount: '-10',
  date: '2026-09-10T12:00:00',
  created_at: '',
  updated_at: '',
  ...over,
});

const ctx: SpendContext = {
  accounts: new Map([
    ['eur', { currency: 'EUR' }],
    ['usd', { currency: 'USD' }],
    ['gbp', { currency: 'GBP' }],
  ]) as SpendContext['accounts'],
  base: 'EUR',
  rates: { base: 'EUR', rates: { EUR: 1, USD: 2 } },
};

describe('category list', () => {
  it('sorts by name, ignoring case and accents', () => {
    const list = [cat({ name: 'zoo' }), cat({ name: 'Éclair' }), cat({ name: 'apple' })];
    expect(sortCategories(list).map((c) => c.name)).toEqual(['apple', 'Éclair', 'zoo']);
  });

  it('searches by name', () => {
    const list = [cat({ name: 'Groceries' }), cat({ name: 'Rent' })];
    expect(searchCategories(list, ' groc ').map((c) => c.name)).toEqual(['Groceries']);
    expect(searchCategories(list, '')).toHaveLength(2);
  });
});

describe('month axis', () => {
  it('lists the last n months oldest first, across a year', () => {
    expect(lastMonths(3, new Date(2026, 0, 15))).toEqual(['2025-11', '2025-12', '2026-01']);
  });

  it('spans the first day to the last instant of the window', () => {
    const w = monthsWindow(['2026-02', '2026-03']);
    expect(new Date(w.start_date).getTime()).toBe(new Date(2026, 1, 1).getTime());
    expect(new Date(w.end_date).getTime()).toBe(new Date(2026, 3, 1).getTime() - 1);
  });

  it('labels ticks with the year only when asked', () => {
    expect(monthTick('2026-09', false)).toBe('Sep');
    expect(monthTick('2026-09', true)).toBe('Sep 26');
  });
});

describe('spend', () => {
  const months = ['2026-08', '2026-09'];

  it('sums money out per month in the base currency, skipping income and transfers', () => {
    const txs = [
      tx({ amount: '-10', date: '2026-08-05T12:00:00' }),
      tx({ amount: '-4', account_id: 'usd', date: '2026-09-02T12:00:00' }),
      tx({ amount: '50', date: '2026-09-03T12:00:00' }),
      tx({
        amount: '-99',
        date: '2026-09-04T12:00:00',
        transfer_info: {} as Transaction['transfer_info'],
      }),
      tx({ amount: '-7', date: '2026-07-30T12:00:00' }),
    ];
    const r = monthlySpend(txs, months, ctx);
    expect(r.series).toEqual([
      { month: '2026-08', total: 10 },
      { month: '2026-09', total: 2 },
    ]);
    expect(r.missing).toEqual([]);
  });

  it('reports currencies with no rate instead of adding them unconverted', () => {
    const r = monthlySpend([tx({ account_id: 'gbp', amount: '-5' })], months, ctx);
    expect(r.series[1].total).toBe(0);
    expect(r.missing).toEqual(['GBP']);
  });

  it('totals per category, skipping uncategorised rows', () => {
    const m = spendByCategory(
      [
        tx({ category_id: 'a', amount: '-1.1' }),
        tx({ category_id: 'a', amount: '-2.2' }),
        tx({ amount: '-3' }),
      ],
      ctx
    );
    expect([...m]).toEqual([['a', 3.3]]);
  });

  it('computes total, average, peak and this month against the earlier average', () => {
    const s = spendStats([
      { month: '2026-07', total: 100 },
      { month: '2026-08', total: 50 },
      { month: '2026-09', total: 150 },
    ]);
    expect(s).toEqual({
      total: 300,
      average: 100,
      peak: { month: '2026-09', total: 150 },
      thisMonth: 150,
      vsAverage: 100,
      earlierAverage: 75,
    });
    expect(spendStats([{ month: '2026-09', total: 0 }]).peak).toBeNull();
    expect(spendStats([{ month: '2026-09', total: 5 }]).vsAverage).toBeNull();
  });
});

describe('category form', () => {
  it('defaults a new category to the folder icon and a palette colour', () => {
    const d = categoryDefaults(undefined, 0);
    expect(d).toEqual({ name: '', icon: '📁', color: PALETTE[0], excluded: false });
    expect(PALETTE).toContain(pickColor(0.99));
  });

  it('prefills from an existing category, nulls as empty', () => {
    expect(
      categoryDefaults(cat({ icon: null, color: null, is_excluded_from_analysis: true }))
    ).toEqual({
      name: 'Groceries',
      icon: '',
      color: '',
      excluded: true,
    });
  });

  it('validates name, one emoji and a hex colour', () => {
    expect(
      categorySchema.safeParse({ name: ' ', icon: '', color: '', excluded: false }).success
    ).toBe(false);
    expect(
      categorySchema.safeParse({ name: 'A', icon: '', color: '#12345', excluded: false }).success
    ).toBe(false);
    expect(
      categorySchema.safeParse({ name: 'A', icon: '🛒', color: '#abcdef', excluded: false }).success
    ).toBe(true);
  });

  it('create leaves out empty icon and colour and uppercases the colour', () => {
    expect(
      buildCategoryRequest({ name: ' Food ', icon: '', color: '#abcdef', excluded: false })
    ).toEqual({
      name: 'Food',
      color: '#ABCDEF',
    });
    expect(buildCategoryRequest({ name: 'Food', icon: '', color: '', excluded: true })).toEqual({
      name: 'Food',
    });
  });

  it('update sends cleared fields as empty strings and the exclusion only when it changed', () => {
    const before = cat();
    expect(
      buildCategoryRequest({ name: 'Groceries', icon: '', color: '', excluded: false }, before)
    ).toEqual({
      name: 'Groceries',
      icon: '',
      color: '',
    });
    expect(
      buildCategoryRequest(
        { name: 'Groceries', icon: '🛒', color: '#3987e5', excluded: true },
        before
      )
    ).toEqual({ name: 'Groceries', icon: '🛒', color: '#3987E5', is_excluded_from_analysis: true });
  });
});
