import { describe, expect, it } from 'vitest';
import { BudgetHealth, type Budget, type BudgetRange } from '@/api/types';
import {
  budgetChanged,
  budgetDefaults,
  budgetSchema,
  buildBudgetRequest,
  buildRangeFromBudget,
  rangeChanged,
  ALL_SPENDING,
  ANY_ACCOUNT,
} from '@/features/budgets/forms/budgetForm';
import { buildRangeRequest, rangeSchema } from '@/features/budgets/forms/rangeForm';
import {
  budgetStats,
  currentRange,
  daysLeft,
  elapsedDays,
  fieldFromMessage,
  formErrorTarget,
  overall,
  Pace,
  paceOf,
  paceSeries,
  periodCounts,
  periodDays,
  sortBudgets,
  sortRanges,
  spendOf,
  spreadLabels,
} from '@/features/budgets/lib/budgetsModel';

const range = (over: Partial<BudgetRange> = {}): BudgetRange => ({
  id: 'r1',
  budget_id: 'b1',
  limit_amount: '300.00',
  period: 'MONTHLY',
  start_date: '2026-09-01',
  end_date: '2026-09-30',
  ...over,
});

const budget = (over: Partial<Budget> = {}): Budget => ({
  id: 'b1',
  name: 'Groceries',
  filters: { category_id: 'c1' },
  active_range: range(),
  current_spending: '150.00',
  percentage_used: 50,
  remaining: '150.00',
  status: BudgetHealth.OnTrack,
  days_left: 4,
  currency: 'EUR',
  ...over,
});

describe('days left and elapsed', () => {
  it('counts the window inclusively', () => {
    expect(periodDays('2026-09-01', '2026-09-30')).toBe(30);
    expect(periodDays('2026-09-01', '2026-09-01')).toBe(1);
    expect(periodDays('2026-09-02', '2026-09-01')).toBe(0);
  });

  it('prefers the server figure, clamped to the window', () => {
    expect(daysLeft('2026-09-01', '2026-09-30', 4, '2026-09-10')).toBe(4);
    expect(daysLeft('2026-09-01', '2026-09-30', 99, '2026-09-10')).toBe(30);
    expect(daysLeft('2026-09-01', '2026-09-30', -2, '2026-09-10')).toBe(0);
  });

  it('works it out from today, counting today, when the server leaves it out', () => {
    expect(daysLeft('2026-09-01', '2026-09-30', null, '2026-09-27')).toBe(4);
    expect(daysLeft('2026-09-01', '2026-09-30', undefined, '2026-09-30')).toBe(1);
    expect(daysLeft('2026-09-01', '2026-09-30', undefined, '2026-10-02')).toBe(0);
    expect(daysLeft('2026-09-01', '2026-09-30', undefined, '2026-08-20')).toBe(30);
  });

  it('turns days left into the day of the period', () => {
    expect(elapsedDays(30, 4)).toBe(27);
    expect(elapsedDays(30, 30)).toBe(1);
    expect(elapsedDays(30, 0)).toBe(30);
    expect(elapsedDays(0, 0)).toBe(0);
  });
});

describe('pace and health', () => {
  it('is on track within the slack, ahead past it, over past the limit', () => {
    expect(paceOf(50, 50)).toBe(Pace.OnTrack);
    expect(paceOf(53, 50)).toBe(Pace.OnTrack);
    expect(paceOf(54, 50)).toBe(Pace.Ahead);
    expect(paceOf(100, 90)).toBe(Pace.Ahead);
    expect(paceOf(100.5, 100)).toBe(Pace.Over);
  });

  it('builds the current period from the server fields', () => {
    const s = budgetStats(budget(), '2026-09-27');
    expect(s).toMatchObject({
      active: true,
      limit: 300,
      spent: 150,
      remaining: 150,
      percent: 50,
      totalDays: 30,
      daysLeft: 4,
      elapsed: 27,
      health: BudgetHealth.OnTrack,
      pace: Pace.OnTrack,
    });
    expect(s.elapsedPct).toBeCloseTo(90);
    expect(s.safePerDay).toBeCloseTo(37.5);
  });

  it('marks an over budget and stops the per day allowance', () => {
    const s = budgetStats(
      budget({
        current_spending: '360',
        percentage_used: 120,
        remaining: '-60',
        status: BudgetHealth.Over,
      }),
      '2026-09-27'
    );
    expect(s.remaining).toBe(-60);
    expect(s.pace).toBe(Pace.Over);
    expect(s.safePerDay).toBe(0);
  });

  it('falls back to the thresholds when the server sends no status', () => {
    const s = budgetStats(budget({ status: null, percentage_used: 85 }), '2026-09-27');
    expect(s.health).toBe(BudgetHealth.Warning);
    expect(budgetStats(budget({ status: null, percentage_used: 100 })).health).toBe(
      BudgetHealth.Warning
    );
    expect(budgetStats(budget({ status: null, percentage_used: 100.1 })).health).toBe(
      BudgetHealth.Over
    );
  });

  it('has nothing to show with no active range', () => {
    const s = budgetStats(budget({ active_range: null }));
    expect(s.active).toBe(false);
    expect(s.health).toBeNull();
    expect(s.pace).toBe(Pace.None);
  });
});

describe('list', () => {
  const all = [
    budgetStats(budget({ id: 'a', name: 'A', percentage_used: 40 }), '2026-09-27'),
    budgetStats(
      budget({ id: 'b', name: 'B', percentage_used: 120, status: BudgetHealth.Over }),
      '2026-09-27'
    ),
    budgetStats(budget({ id: 'c', name: 'C', active_range: null }), '2026-09-27'),
    budgetStats(
      budget({
        id: 'd',
        name: 'D',
        percentage_used: 90,
        status: BudgetHealth.Warning,
        active_range: range({
          id: 'r4',
          period: 'WEEKLY',
          limit_amount: '100',
          start_date: '2026-09-21',
          end_date: '2026-09-27',
        }),
        current_spending: '90',
      }),
      '2026-09-27'
    ),
  ];

  it('sorts worst first and no range last', () => {
    expect(sortBudgets(all).map((s) => s.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('counts budgets per period', () => {
    const c = periodCounts(all);
    expect(c.ALL).toBe(4);
    expect(c.MONTHLY).toBe(2);
    expect(c.WEEKLY).toBe(1);
    expect(c.DAILY).toBe(0);
  });

  it("averages each budget's own usage, apart from the combined figure", () => {
    const o = overall(all);
    expect(o.counted).toBe(3);
    // 40, 120 and 90: a mean of 83.3, not 150+150+90 over 300+300+100.
    expect(o.averagePercent).toBeCloseTo((40 + 120 + 90) / 3);
    expect(o.limit).toBe(700);
    expect(o.spent).toBe(390);
    expect(o.percent).toBeCloseTo((390 / 700) * 100);
    expect([o.ok, o.warning, o.over]).toEqual([1, 1, 1]);
  });

  it('has no average with nothing active', () => {
    expect(overall([all[2]]).averagePercent).toBeNull();
  });
});

describe('pace chart series', () => {
  it('counts money out less what others owe', () => {
    expect(spendOf({ amount: '-50' })).toBe(50);
    expect(spendOf({ amount: '-50', splits: [{ amount: '20' } as never] })).toBe(30);
    expect(spendOf({ amount: '25' })).toBe(0);
  });

  it('accumulates by day and scales to the server total', () => {
    const txs = [
      { amount: '-10', date: '2026-09-01T09:00:00Z' },
      { amount: '-30', date: '2026-09-03T18:00:00Z' },
      { amount: '-99', date: '2026-08-31T23:00:00Z' },
    ];
    const s = paceSeries('2026-09-01', '2026-09-30', 4, txs, 80);
    expect(s.days).toHaveLength(30);
    expect(s.days[0]).toBe('2026-09-01');
    expect(s.actual).toEqual([20, 20, 80, 80]);
  });

  it('puts the server total on today when no transactions loaded', () => {
    expect(paceSeries('2026-09-01', '2026-09-03', 2, [], 12).actual).toEqual([0, 12]);
  });
});

describe('ranges', () => {
  const list = [
    range({ id: 'old', start_date: '2026-01-01', end_date: '2026-08-31' }),
    range({ id: 'now', start_date: '2026-09-01', end_date: null }),
  ];
  it('finds the range covering today, open ended included', () => {
    expect(currentRange(list, '2026-09-27')?.id).toBe('now');
    expect(currentRange(list, '2026-03-01')?.id).toBe('old');
    expect(currentRange(list, '2025-12-31')).toBeUndefined();
  });
  it('lists newest first', () => {
    expect(sortRanges(list).map((r) => r.id)).toEqual(['now', 'old']);
  });
});

describe('form errors', () => {
  const fields = ['limit_amount', 'period', 'start_date', 'end_date'];
  it('reads the field from the server sentence', () => {
    expect(fieldFromMessage('limit_amount: must be positive', fields)).toBe('limit_amount');
    expect(fieldFromMessage('End date must be after start date', fields)).toBe('end_date');
    expect(fieldFromMessage('Something odd', fields)).toBeNull();
  });
  it('puts 422s on their field and 409s on the form', () => {
    expect(
      formErrorTarget({ kind: 'validation', message: 'limit_amount: must be positive' }, fields)
    ).toEqual({ field: 'limit_amount', message: 'Must be positive' });
    expect(
      formErrorTarget(
        { kind: 'conflict', message: 'Range overlaps an existing range (2026-09-01 to open)' },
        fields
      )
    ).toEqual({ field: null, message: 'Range overlaps an existing range (2026-09-01 to open)' });
    expect(
      formErrorTarget(
        { kind: 'validation', message: 'x', fieldErrors: { start_date: 'Bad date' } },
        fields
      )
    ).toEqual({ field: 'start_date', message: 'Bad date' });
  });
});

describe('pace monitor labels', () => {
  it('keeps labels apart, in order and in bounds', () => {
    const out = spreadLabels([50, 52, 51, 200], 10, 0, 100);
    expect(out[0]).toBe(50);
    expect(out[2]).toBe(60);
    expect(out[1]).toBe(70);
    expect(out[3]).toBe(100);
  });
});

describe('budget form', () => {
  it('fills an edit from the stored range and the filters', () => {
    const v = budgetDefaults(
      budget(),
      range({ limit_amount: '250.50', start_date: '2026-07-01', end_date: null })
    );
    expect(v).toMatchObject({
      name: 'Groceries',
      category: 'c1',
      account: ANY_ACCOUNT,
      limit_amount: '250.5',
      start_date: '2026-07-01',
    });
  });

  it('sends no filter for all spending and any account', () => {
    const v = {
      ...budgetDefaults(),
      name: ' Everything ',
      category: ALL_SPENDING,
      account: ANY_ACCOUNT,
    };
    expect(buildBudgetRequest(v)).toEqual({ name: 'Everything', filters: {} });
  });

  it('keeps the stored end date and spots what changed', () => {
    const r = range({ end_date: '2026-12-31' });
    const v = budgetDefaults(budget(), r);
    const req = buildRangeFromBudget(v, r);
    expect(req.end_date).toBe('2026-12-31');
    expect(rangeChanged(req, r)).toBe(false);
    expect(rangeChanged({ ...req, limit_amount: 301 }, r)).toBe(true);
    expect(budgetChanged(v, budget())).toBe(false);
    expect(budgetChanged({ ...v, account: 'a9' }, budget())).toBe(true);
  });

  it('rejects a zero limit and a blank name', () => {
    const r = budgetSchema.safeParse({ ...budgetDefaults(), name: ' ', limit_amount: '0' });
    expect(r.success).toBe(false);
    const paths = r.success ? [] : r.error.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(['name', 'limit_amount']));
  });
});

describe('range form', () => {
  it('allows a one day range and rejects an end before the start', () => {
    const base = { limit_amount: '10', period: 'DAILY', start_date: '2026-09-10' } as const;
    expect(rangeSchema.safeParse({ ...base, end_date: '2026-09-10' }).success).toBe(true);
    const bad = rangeSchema.safeParse({ ...base, end_date: '2026-09-09' });
    expect(bad.success).toBe(false);
    expect(bad.success ? null : bad.error.issues[0].path).toEqual(['end_date']);
  });
  it('sends a blank end as open ended', () => {
    expect(
      buildRangeRequest({
        limit_amount: ' 99.5 ',
        period: 'WEEKLY',
        start_date: '2026-09-01',
        end_date: '',
      })
    ).toEqual({ limit_amount: 99.5, period: 'WEEKLY', start_date: '2026-09-01', end_date: null });
  });
});
