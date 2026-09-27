/** The schedule form: values, validation and the create or update request it becomes. */
import { z } from 'zod';
import {
  JobType,
  type CreateScheduleRequest,
  type Schedule,
  type UpdateScheduleRequest,
} from '@/api/types';
import {
  CRON_PRESETS,
  cronShapeError,
  LOOKBACK_DEFAULT,
  LOOKBACK_MAX,
  LOOKBACK_MIN,
  SCHEDULE_JOB_TYPES,
} from '../lib/cron';

export const NAME_MAX = 100;

export const scheduleSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter a name').max(NAME_MAX, `At most ${NAME_MAX} characters`),
    jobType: z.enum(SCHEDULE_JOB_TYPES),
    cron: z.string(),
    lookback: z.string(),
    bankProviderId: z.string(),
  })
  .superRefine((v, ctx) => {
    const cronErr = cronShapeError(v.cron);
    if (cronErr) ctx.addIssue({ code: 'custom', path: ['cron'], message: cronErr });
    if (v.jobType === JobType.DRIFT_DETECTION) {
      const n = Number(v.lookback);
      if (!/^\d+$/.test(v.lookback.trim()) || n < LOOKBACK_MIN || n > LOOKBACK_MAX)
        ctx.addIssue({
          code: 'custom',
          path: ['lookback'],
          message: `A whole number of days, ${LOOKBACK_MIN} to ${LOOKBACK_MAX}`,
        });
    }
    if (v.jobType === JobType.BANK_SYNC && !v.bankProviderId)
      ctx.addIssue({ code: 'custom', path: ['bankProviderId'], message: 'Pick a bank connection' });
  });

export type ScheduleFormValues = z.infer<typeof scheduleSchema>;

const str = (v: unknown) => (typeof v === 'string' ? v : '');

export function scheduleDefaults(s?: Schedule): ScheduleFormValues {
  const p = s?.parameters ?? {};
  const lookback = typeof p.lookback_days === 'number' ? p.lookback_days : LOOKBACK_DEFAULT;
  const jobType = (SCHEDULE_JOB_TYPES as readonly string[]).includes(s?.job_type ?? '')
    ? (s!.job_type as ScheduleFormValues['jobType'])
    : JobType.DRIFT_DETECTION;
  return {
    name: s?.name ?? '',
    jobType,
    cron: s?.cron_expr ?? CRON_PRESETS[1].expr,
    lookback: String(lookback),
    bankProviderId: str(p.bank_provider_id),
  };
}

const norm = (expr: string) => expr.trim().split(/\s+/).join(' ');

/** Only the parameters the chosen job type reads; anything else already stored is kept. */
export function scheduleParameters(
  v: ScheduleFormValues,
  before?: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(before ?? {}) };
  delete out.lookback_days;
  delete out.bank_provider_id;
  if (v.jobType === JobType.DRIFT_DETECTION) out.lookback_days = Number(v.lookback);
  if (v.jobType === JobType.BANK_SYNC) out.bank_provider_id = v.bankProviderId;
  return out;
}

export function buildScheduleCreate(v: ScheduleFormValues): CreateScheduleRequest {
  const parameters = scheduleParameters(v);
  return {
    name: v.name.trim(),
    job_type: v.jobType,
    cron_expr: norm(v.cron),
    ...(Object.keys(parameters).length ? { parameters } : {}),
  };
}

/** The job type cannot change after creation; everything else is sent in full. */
export function buildScheduleUpdate(
  v: ScheduleFormValues,
  before: Schedule
): UpdateScheduleRequest {
  return {
    name: v.name.trim(),
    cron_expr: norm(v.cron),
    parameters: scheduleParameters(v, before.parameters),
  };
}
