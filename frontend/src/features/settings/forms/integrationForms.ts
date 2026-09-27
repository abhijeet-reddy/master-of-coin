import { z } from 'zod';
import { toIsoDate } from '@/lib/format';

export const splitProSchema = z.object({
  email: z.string().trim().pipe(z.email('Enter the email you use on SplitPro')),
});
export type SplitProValues = z.infer<typeof splitProSchema>;

/** Drift detection compares the ledger with the split provider across a window of dates. */
export const driftSchema = z
  .object({
    start_date: z.string().min(1, 'Pick a start date'),
    end_date: z.string().min(1, 'Pick an end date'),
  })
  .refine((v) => !v.start_date || !v.end_date || v.start_date <= v.end_date, {
    path: ['end_date'],
    message: 'End date must be on or after the start date',
  });
export type DriftValues = z.infer<typeof driftSchema>;

/** The last 90 days, ending today. */
export function driftDefaults(today: Date): DriftValues {
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 89);
  return { start_date: toIsoDate(from), end_date: toIsoDate(today) };
}
