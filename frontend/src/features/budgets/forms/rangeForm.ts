/** One budget range: limit, period, start and an optional end. */
import { z } from 'zod';
import type { BudgetRange, BudgetRangeRequest } from '@/api/types';
import { dateField, limitField, monthStart, periodField } from './budgetForm';

export const rangeSchema = z
  .object({
    limit_amount: limitField,
    period: periodField,
    start_date: dateField,
    end_date: z.string().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.end_date && v.end_date < v.start_date)
      ctx.addIssue({
        code: 'custom',
        path: ['end_date'],
        message: 'End date must be on or after the start date',
      });
  });

export type RangeFormValues = z.infer<typeof rangeSchema>;
export const RANGE_FIELDS = ['limit_amount', 'period', 'start_date', 'end_date'] as const;

export function rangeDefaults(range?: BudgetRange, prev?: BudgetRange): RangeFormValues {
  return {
    limit_amount: range
      ? String(Number(range.limit_amount))
      : prev
        ? String(Number(prev.limit_amount))
        : '',
    period: range?.period ?? prev?.period ?? 'MONTHLY',
    start_date: range?.start_date ?? monthStart(),
    end_date: range?.end_date ?? null,
  };
}

export function buildRangeRequest(v: RangeFormValues): BudgetRangeRequest {
  return {
    limit_amount: Number(v.limit_amount.trim()),
    period: v.period,
    start_date: v.start_date,
    end_date: v.end_date || null,
  };
}
