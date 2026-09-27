/** Transfer and convert-to-transfer forms: schemas and request builders. */
import { z } from 'zod';
import type { ConvertToTransferRequest, CreateTransferRequest } from '@/api/types';
import { isFuture, toApiDateTime } from '../lib/datetime';

const positive = (v: string) => Number.isFinite(Number(v)) && Number(v) > 0;
const blankOrPositive = (v: string) => v.trim() === '' || positive(v);

/** Above this relative gap between the two legs we warn (a fat finger, not a fee). */
export const LEG_WARN_RATIO = 0.2;

export const transferSchema = z
  .object({
    from_account_id: z.string().min(1, 'Pick the account the money leaves'),
    to_account_id: z.string().min(1, 'Pick the account the money arrives in'),
    amount: z.string().trim().refine(positive, 'Enter an amount above 0'),
    /** Cross currency: always the received amount. Same currency: only when `different` is on. */
    to_amount: z.string().refine(blankOrPositive, 'Enter an amount above 0'),
    different: z.boolean(),
    cross: z.boolean(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date is required'),
    time: z.string().regex(/^\d{2}:\d{2}$/, 'Time is required'),
    title: z.string().max(255, 'Keep the title under 255 characters'),
    notes: z.string().max(2000, 'Keep notes under 2000 characters'),
    category_id: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.from_account_id && v.from_account_id === v.to_account_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['to_account_id'],
        message: 'Pick a different account',
      });
    }
    if ((v.cross || v.different) && !positive(v.to_amount)) {
      ctx.addIssue({ code: 'custom', path: ['to_amount'], message: 'Enter the amount received' });
    }
    if (isFuture(v.date, v.time)) {
      ctx.addIssue({ code: 'custom', path: ['date'], message: 'Date cannot be in the future' });
    }
  });

export type TransferFormValues = z.infer<typeof transferSchema>;

export function buildTransferRequest(v: TransferFormValues): CreateTransferRequest {
  const req: CreateTransferRequest = {
    from_account_id: v.from_account_id,
    to_account_id: v.to_account_id,
    from_amount: Number(v.amount),
    date: toApiDateTime(v.date, v.time),
  };
  if ((v.cross || v.different) && positive(v.to_amount)) req.to_amount = Number(v.to_amount);
  if (v.title.trim()) req.title = v.title.trim();
  if (v.notes.trim()) req.notes = v.notes.trim();
  if (v.category_id) req.category_id = v.category_id;
  return req;
}

/** Percent gap between two same-currency legs when it exceeds the warning ratio, else null. */
export function legGapPercent(sent: string, received: string): number | null {
  const a = Number(sent);
  const b = Number(received);
  if (!(a > 0) || !(b > 0)) return null;
  const gap = Math.abs(b - a) / a;
  return gap > LEG_WARN_RATIO ? Math.round(gap * 100) : null;
}

/** Cross currency rate implied by two amounts, e.g. 100 EUR to 85.47 GBP gives 0.8547. */
export function impliedRate(from: string, to: string): number | null {
  const a = Number(from);
  const b = Number(to);
  return a > 0 && b > 0 ? b / a : null;
}

export interface ConvertChoice {
  accountId: string;
  /** Link this existing transaction as the other leg. */
  candidateId: string | null;
  /** Create a new leg instead of linking. */
  createNew: boolean;
  cross: boolean;
  /** Absolute amount on the counterpart (cross currency, or a different same-currency amount). */
  counterpartAmount: string;
  different: boolean;
}

export function buildConvertRequest(c: ConvertChoice): ConvertToTransferRequest {
  if (c.candidateId && !c.createNew)
    return { account_id: c.accountId, counterpart_transaction_id: c.candidateId };
  const req: ConvertToTransferRequest = { account_id: c.accountId };
  if ((c.cross || c.different) && positive(c.counterpartAmount))
    req.counterpart_amount = Number(c.counterpartAmount);
  return req;
}
