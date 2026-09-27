import { z } from 'zod';

const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;
const cents = (n: number) => Math.round(n * 100);

/** The amount is capped at the current debt: the server does not check. */
export function settleSchema(cap: number) {
  return z.object({
    amount: z
      .string()
      .trim()
      .refine((v) => v !== '', 'Enter an amount')
      .refine((v) => v === '' || AMOUNT_RE.test(v), 'Use a number with up to 2 decimals')
      .refine((v) => !AMOUNT_RE.test(v) || Number(v) > 0, 'Enter an amount above 0')
      .refine(
        (v) => !AMOUNT_RE.test(v) || cents(Number(v)) <= cents(cap),
        'Cannot be more than the debt'
      ),
    account_id: z.string().min(1, 'Choose an account'),
  });
}

export type SettleFormValues = z.infer<ReturnType<typeof settleSchema>>;

export const settleDefaults = (cap: number, accountId = ''): SettleFormValues => ({
  amount: cap > 0 ? cap.toFixed(2) : '',
  account_id: accountId,
});

export const buildSettleRequest = (v: SettleFormValues) => ({
  amount: Number(v.amount.trim()),
  account_id: v.account_id,
});
