import { describe, expect, it } from 'vitest';
import { HistoryInterval } from '@/api/analytics';
import { BudgetHealth } from '@/api/types';
import { createFormatters } from '@/lib/format';
import type { BudgetRow } from '@/features/dashboard/lib/dashboardModel';
import {
  daysIn,
  historyInterval,
  monthsInRange,
  monthsToRequest,
  partialMonths,
  presetRange,
  RangePreset,
  resolveRange,
  trendWindow,
} from '@/features/reports/lib/reportRange';
import {
  budgetCountText,
  cashflowText,
  cashflowTotals,
  isQuiet,
  netWorthRange,
  netWorthText,
  trendStats,
  trendText,
} from '@/features/reports/lib/reportsModel';

const today = new Date(2026, 8, 27); // 27 Sep 2026
const fmt = createFormatters();

describe('report range', () => {
  it('resolves presets against today', () => {
    expect(presetRange(RangePreset.ThisMonth, today)).toEqual({
      from: '2026-09-01',
      to: '2026-09-27',
    });
    expect(presetRange(RangePreset.ThreeMonths, today).from).toBe('2026-07-01');
    expect(presetRange(RangePreset.SixMonths, today).from).toBe('2026-04-01');
    expect(presetRange(RangePreset.TwelveMonths, today).from).toBe('2025-10-01');
    expect(presetRange(RangePreset.YearToDate, today).from).toBe('2026-01-01');
  });

  it('uses custom dates, filling gaps and swapping a reversed pair', () => {
    expect(resolveRange(RangePreset.Custom, '2026-05-10', '2026-02-01', today)).toEqual({
      from: '2026-02-01',
      to: '2026-05-10',
    });
    expect(resolveRange(RangePreset.Custom, undefined, undefined, today)).toEqual(
      presetRange(RangePreset.SixMonths, today)
    );
    expect(resolveRange(RangePreset.ThisMonth, '2020-01-01', '2020-02-01', today).from).toBe(
      '2026-09-01'
    );
  });

  it('counts days inclusively', () => {
    expect(daysIn({ from: '2026-09-01', to: '2026-09-01' })).toBe(1);
    expect(daysIn({ from: '2026-01-01', to: '2026-12-31' })).toBe(365);
  });

  it('asks for enough months to reach the start, clipped at 120', () => {
    expect(monthsToRequest({ from: '2026-04-01', to: '2026-09-27' }, today)).toEqual({
      months: 6,
      clipped: false,
    });
    expect(monthsToRequest({ from: '2010-01-01', to: '2026-09-27' }, today)).toEqual({
      months: 120,
      clipped: true,
    });
  });

  it('keeps only the months the range touches', () => {
    const series = ['2026-01', '2026-02', '2026-03', '2026-04'].map((month) => ({ month }));
    expect(
      monthsInRange(series, { from: '2026-02-15', to: '2026-03-02' }).map((m) => m.month)
    ).toEqual(['2026-02', '2026-03']);
  });

  it('clips the daily window to the last 1000 days', () => {
    const short = { from: '2026-01-01', to: '2026-09-27' };
    expect(trendWindow(short)).toEqual({ range: short, clipped: false });
    const long = trendWindow({ from: '2020-01-01', to: '2026-09-27' });
    expect(long.clipped).toBe(true);
    expect(daysIn(long.range)).toBe(1000);
    expect(long.range.to).toBe('2026-09-27');
  });

  it('plots weekly up to 120 days and flags partial months', () => {
    expect(historyInterval({ from: '2026-07-01', to: '2026-09-27' })).toBe(HistoryInterval.Week);
    expect(historyInterval({ from: '2026-01-01', to: '2026-09-27' })).toBe(HistoryInterval.Month);
    expect(partialMonths({ from: '2026-01-01', to: '2026-03-31' })).toBe(false);
    expect(partialMonths({ from: '2026-01-01', to: '2026-09-27' })).toBe(true);
    expect(partialMonths({ from: '2026-01-05', to: '2026-03-31' })).toBe(true);
  });
});

describe('reports model', () => {
  const series = [
    { month: '2026-07', income: '3000', spend: '2000', net: '1000' },
    { month: '2026-08', income: '3000', spend: '3500', net: '-500' },
    { month: '2026-09', income: '3000', spend: '1000', net: '2000' },
  ];

  it('totals cash flow over the months', () => {
    const t = cashflowTotals(series);
    expect(t).toMatchObject({
      months: 3,
      income: 9000,
      spend: 6500,
      net: 2500,
      avgSpend: 6500 / 3,
    });
    expect(t.savingsRate).toBeCloseTo((2500 / 9000) * 100);
    expect(t.best?.month).toBe('2026-09');
    expect(t.worst?.month).toBe('2026-08');
    expect(isQuiet(t)).toBe(false);
    expect(cashflowTotals([]).savingsRate).toBeNull();
    expect(isQuiet(cashflowTotals([]))).toBe(true);
  });

  it('describes the cash flow in words', () => {
    const text = cashflowText(cashflowTotals(series), fmt);
    expect(text).toMatch(/^Across 3 months: /);
    expect(text).toContain('Best month');
    expect(cashflowText(cashflowTotals([]), fmt)).toBe('No income or spend in this period.');
  });

  it('summarises daily spend', () => {
    const s = trendStats([
      { date: '2026-09-01', amount: '10' },
      { date: '2026-09-02', amount: '0' },
      { date: '2026-09-03', amount: '50' },
      { date: '2026-09-04', amount: '20' },
    ]);
    expect(s).toEqual({
      total: 80,
      perDay: 20,
      activeDays: 3,
      peak: { date: '2026-09-03', amount: 50 },
    });
    expect(trendText(s, 4, fmt)).toContain('biggest day');
    expect(trendText(trendStats([]), 4, fmt)).toBe('No spending in this period.');
  });

  it('reads net worth across the range', () => {
    const r = netWorthRange([
      { date: '2026-07-01', total: '1000', by_type: { CHECKING: '1000' } },
      { date: '2026-08-01', total: '800', by_type: { CHECKING: '800' } },
      { date: '2026-09-01', total: '1500', by_type: { CHECKING: '1700', CREDIT_CARD: '-200' } },
    ]);
    expect(r).toMatchObject({ start: 1000, end: 1500, change: 500, percent: 50 });
    expect(r?.high.date).toBe('2026-09-01');
    expect(r?.low.date).toBe('2026-08-01');
    expect(r?.sheet.assets).toBe(1700);
    expect(r?.sheet.liabilities).toBe(-200);
    expect(netWorthText(r!, fmt)).toContain(', up ');
    expect(netWorthRange([])).toBeNull();
  });

  it('counts budgets by health', () => {
    const row = (health: BudgetHealth) => ({ health }) as BudgetRow;
    expect(
      budgetCountText([
        row(BudgetHealth.Over),
        row(BudgetHealth.OnTrack),
        row(BudgetHealth.OnTrack),
      ])
    ).toBe('3 budgets: 1 exceeded, 0 at warning, 2 on track.');
  });
});
