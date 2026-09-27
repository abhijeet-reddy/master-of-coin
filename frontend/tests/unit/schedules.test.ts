import { describe, expect, it } from 'vitest';
import { JobType, type Schedule } from '@/api/types';
import {
  buildScheduleCreate,
  buildScheduleUpdate,
  scheduleDefaults,
  scheduleParameters,
  scheduleSchema,
  type ScheduleFormValues,
} from '@/features/schedules/forms/scheduleForm';
import {
  CRON_PRESETS,
  CronPresetId,
  cronLabel,
  cronShapeError,
  describeCron,
  parameterLines,
  presetFor,
  timeUntil,
} from '@/features/schedules/lib/cron';

describe('cron presets', () => {
  it('describes every preset the way it runs', () => {
    for (const p of CRON_PRESETS) expect(describeCron(p.expr)).toBe(p.description);
  });

  it('weekly runs on Sunday, because the backend numbers weekdays from 1 = Sunday', () => {
    const weekly = CRON_PRESETS.find((p) => p.id === CronPresetId.Weekly)!;
    expect(weekly.expr).toBe('0 0 * * 1');
    expect(weekly.description).toBe('Every Sunday at 00:00 UTC');
  });

  it('matches presets ignoring spacing', () => {
    expect(presetFor('  0 0  * * *')?.id).toBe(CronPresetId.Daily);
    expect(presetFor('5 0 * * *')).toBeUndefined();
  });
});

describe('describeCron', () => {
  it('handles the common shapes', () => {
    expect(describeCron('15 * * * *')).toBe('Every hour at 15 past');
    expect(describeCron('30 6 * * 2')).toBe('Every Monday at 06:30 UTC');
    expect(describeCron('0 9 * * SAT')).toBe('Every Saturday at 09:00 UTC');
    expect(describeCron('0 9 22 * *')).toBe('Monthly on the 22nd at 09:00 UTC');
    expect(describeCron('0 9 11 * *')).toBe('Monthly on the 11th at 09:00 UTC');
  });

  it('gives up on anything else', () => {
    expect(describeCron('*/15 * * * *')).toBeNull();
    expect(describeCron('0 9 * 1 *')).toBeNull();
    expect(describeCron('0 9 * * 1-5')).toBeNull();
    expect(describeCron('bad')).toBeNull();
  });

  it('falls back to the server text, then the expression', () => {
    expect(cronLabel('0 9 * * 1-5', 'Weekdays at 9')).toBe('Weekdays at 9');
    expect(cronLabel('0 9 * * 1-5', '  ')).toBe('0 9 * * 1-5');
  });
});

describe('cronShapeError', () => {
  it('checks the shape and rejects weekday 0', () => {
    expect(cronShapeError('')).toBe('Enter a cron expression');
    expect(cronShapeError('0 0 * *')).toMatch(/five fields/);
    expect(cronShapeError('0 0 * * 0')).toMatch(/1 \(Sunday\)/);
    expect(cronShapeError('0 0 * * 0-3')).toMatch(/0 is not valid/);
    expect(cronShapeError('0 0 * * 1')).toBeNull();
  });
});

describe('timeUntil', () => {
  const now = Date.parse('2026-09-27T12:00:00Z');
  it('rounds to minutes, hours and days', () => {
    expect(timeUntil('2026-09-27T11:00:00Z', now)).toBe('due');
    expect(timeUntil('2026-09-27T12:04:10Z', now)).toBe('in 5m');
    expect(timeUntil('2026-09-27T15:00:00Z', now)).toBe('in 3h');
    expect(timeUntil('2026-09-29T11:00:00Z', now)).toBe('in 47h');
    expect(timeUntil('2026-10-02T12:00:00Z', now)).toBe('in 5d');
    expect(timeUntil('nonsense', now)).toBe('');
  });
});

describe('parameterLines', () => {
  it('shows lookback and bank names', () => {
    expect(parameterLines(JobType.DRIFT_DETECTION, { lookback_days: 1 })).toEqual([
      { label: 'Lookback', value: '1 day' },
    ]);
    expect(parameterLines(JobType.DRIFT_DETECTION, undefined)).toEqual([
      { label: 'Lookback', value: '7 days' },
    ]);
    expect(
      parameterLines(JobType.BANK_SYNC, { bank_provider_id: 'b1' }, () => 'Monzo (TrueLayer)')
    ).toEqual([{ label: 'Bank connection', value: 'Monzo (TrueLayer)' }]);
    expect(parameterLines(JobType.BANK_SYNC, {})).toEqual([
      { label: 'Bank connection', value: 'Not set' },
    ]);
    expect(parameterLines(JobType.PORTFOLIO_SYNC, {})).toEqual([]);
  });
});

describe('scheduleForm', () => {
  const values = (over: Partial<ScheduleFormValues> = {}): ScheduleFormValues => ({
    ...scheduleDefaults(),
    name: 'Nightly',
    ...over,
  });
  const issues = (v: ScheduleFormValues) => {
    const r = scheduleSchema.safeParse(v);
    return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
  };

  it('defaults to a daily drift check', () => {
    expect(scheduleDefaults()).toEqual({
      name: '',
      jobType: JobType.DRIFT_DETECTION,
      cron: '0 0 * * *',
      lookback: '7',
      bankProviderId: '',
    });
  });

  it('validates per job type', () => {
    expect(issues(values())).toEqual([]);
    expect(issues(values({ name: ' ' }))).toEqual(['name']);
    expect(issues(values({ cron: '0 0 * * 0' }))).toEqual(['cron']);
    expect(issues(values({ lookback: '0' }))).toEqual(['lookback']);
    expect(issues(values({ lookback: '1.5' }))).toEqual(['lookback']);
    expect(issues(values({ jobType: JobType.BANK_SYNC, lookback: 'x' }))).toEqual([
      'bankProviderId',
    ]);
    expect(issues(values({ jobType: JobType.PORTFOLIO_SYNC, lookback: 'x' }))).toEqual([]);
  });

  it('sends only the parameters the job type reads', () => {
    expect(scheduleParameters(values({ lookback: '14' }))).toEqual({ lookback_days: 14 });
    expect(
      scheduleParameters(values({ jobType: JobType.BANK_SYNC, bankProviderId: 'b1' }), {
        lookback_days: 3,
        other: true,
      })
    ).toEqual({ bank_provider_id: 'b1', other: true });
    expect(
      buildScheduleCreate(values({ jobType: JobType.PORTFOLIO_SYNC, cron: ' 0  1 * * * ' }))
    ).toEqual({ name: 'Nightly', job_type: JobType.PORTFOLIO_SYNC, cron_expr: '0 1 * * *' });
  });

  it('round trips an existing schedule without changing its job type', () => {
    const s = {
      id: 's1',
      name: 'Bank',
      job_type: JobType.BANK_SYNC,
      cron_expr: '0 * * * *',
      parameters: { bank_provider_id: 'b1' },
    } as unknown as Schedule;
    const v = scheduleDefaults(s);
    expect(v).toMatchObject({ name: 'Bank', jobType: JobType.BANK_SYNC, bankProviderId: 'b1' });
    const body = buildScheduleUpdate({ ...v, name: 'Bank hourly ' }, s);
    expect(body).toEqual({
      name: 'Bank hourly',
      cron_expr: '0 * * * *',
      parameters: { bank_provider_id: 'b1' },
    });
    expect('job_type' in body).toBe(false);
  });
});
