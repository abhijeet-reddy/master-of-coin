import { describe, expect, it } from 'vitest';
import { AlertTone, buildAlerts, countBudgets, latestSync } from '@/app/shell/alerts';
import { JobStatus, JobType, type BackgroundJobSummary } from '@/api/types/jobs';
import type { Budget, Transaction } from '@/api/types';
import { createFormatters, MINUS } from '@/lib/format';

const fmt = createFormatters();

function budget(id: string, name: string, pct: number, spent: string, limit: string): Budget {
  return {
    id,
    name,
    filters: {},
    active_range: {
      id: `${id}-r`,
      budget_id: id,
      limit_amount: limit,
      period: 'MONTHLY',
      start_date: '2026-09-01',
      end_date: '2026-09-30',
    },
    current_spending: spent,
    percentage_used: pct,
  };
}

function tx(id: string, title: string, amount: string, transfer = false): Transaction {
  return {
    id,
    user_id: 'u',
    account_id: 'acc',
    title,
    amount,
    date: '2026-09-26',
    created_at: '2026-09-26T10:00:00Z',
    updated_at: '2026-09-26T10:00:00Z',
    ...(transfer
      ? {
          transfer_info: {
            transfer_id: 't',
            linked_account_id: 'b',
            linked_account_name: 'Savings',
          } as Transaction['transfer_info'],
        }
      : {}),
  };
}

function job(id: string, type: JobType, status: JobStatus, at: string): BackgroundJobSummary {
  return { id, job_type: type, status, created_at: at, completed_at: at };
}

describe('buildAlerts', () => {
  it('returns nothing when all is well', () => {
    expect(buildAlerts({ fmt, budgets: [budget('b', 'Food', 40, '40', '100')] })).toEqual([]);
  });

  it('raises over and warning budgets with amounts and percentages', () => {
    const alerts = buildAlerts({
      fmt,
      budgets: [
        budget('a', 'Groceries', 85, '425', '500'),
        budget('b', 'Dining', 125, '250', '200'),
      ],
    });
    expect(alerts.map((a) => [a.tone, a.lead, a.value])).toEqual([
      [AlertTone.Crit, 'Dining over by', '€50.00'],
      [AlertTone.Warn, 'Groceries at', '85%'],
    ]);
    expect(alerts[0].href).toBe('/budgets/b');
  });

  it('flags large spends but not transfers or income', () => {
    const alerts = buildAlerts({
      fmt,
      recent: [
        tx('1', 'Laptop', '-1200'),
        tx('2', 'To savings', '-2000', true),
        tx('3', 'Salary', '3000'),
        tx('4', 'Coffee', '-4'),
      ],
      currencyOf: () => 'EUR',
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      tone: AlertTone.Info,
      value: `Laptop ${MINUS}€1,200.00`,
      href: '/transactions/1',
    });
  });

  it('orders crit, warn, info, pos and keeps input order within a tone', () => {
    const alerts = buildAlerts({
      fmt,
      owedToMe: '42',
      recent: [tx('1', 'Rent', '-900')],
      budgets: [budget('w', 'Fuel', 90, '90', '100')],
      lastSync: job('j', JobType.BANK_SYNC, JobStatus.FAILED, '2026-09-27T08:00:00Z'),
    });
    expect(alerts.map((a) => a.tone)).toEqual([
      AlertTone.Crit,
      AlertTone.Warn,
      AlertTone.Info,
      AlertTone.Pos,
    ]);
    expect(alerts[0]).toMatchObject({ value: 'Bank sync', href: '/jobs/BANK_SYNC/j' });
    expect(alerts[3].value).toBe('€42.00');
  });

  it('never uses arrow or dash glyphs in its copy', () => {
    const alerts = buildAlerts({
      fmt,
      owedToMe: 5,
      budgets: [budget('a', 'A', 99, '99', '100'), budget('b', 'B', 150, '150', '100')],
      lastSync: job('j', JobType.PORTFOLIO_SYNC, JobStatus.FAILED, '2026-09-27T08:00:00Z'),
    });
    const copy = alerts.map((a) => [a.lead, a.value, a.tail ?? ''].join(' ')).join(' ');
    expect(copy).not.toMatch(/[→–—]|->/);
  });
});

describe('countBudgets', () => {
  it('counts over, warning and total, skipping unknown usage', () => {
    const unknown = { ...budget('x', 'X', 0, '0', '0'), percentage_used: undefined };
    expect(
      countBudgets([
        budget('a', 'A', 10, '1', '10'),
        budget('b', 'B', 80, '8', '10'),
        budget('c', 'C', 101, '11', '10'),
        unknown,
      ])
    ).toEqual({ over: 1, warning: 1, total: 3 });
  });
});

describe('latestSync', () => {
  it('picks the newest finished sync job and ignores drift checks and running jobs', () => {
    const jobs = [
      job('old', JobType.BANK_SYNC, JobStatus.COMPLETED, '2026-09-25T08:00:00Z'),
      job('new', JobType.PORTFOLIO_SYNC, JobStatus.FAILED, '2026-09-26T08:00:00Z'),
      job('drift', JobType.DRIFT_DETECTION, JobStatus.COMPLETED, '2026-09-27T08:00:00Z'),
      job('run', JobType.BULK_SYNC, JobStatus.RUNNING, '2026-09-27T09:00:00Z'),
    ];
    expect(latestSync(jobs)?.id).toBe('new');
    expect(latestSync([])).toBeNull();
  });
});
