/**
 * Transaction create / edit / duplicate form: schema, defaults and the pure
 * mapping from form values to API requests.
 */
import { z } from 'zod';
import type {
  CreateDebtTransactionRequest,
  CreateTransactionRequest,
  CurrencyCode,
  Transaction,
  UpdateExpenseDetailsRequest,
} from '@/api/types';
import { toNumber } from '@/lib/format';
import { fromApiDateTime, isFuture, nowParts, toApiDateTime } from '../lib/datetime';
import { round2 } from '../lib/ledger';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const positive = (v: string) => Number.isFinite(Number(v)) && Number(v) > 0;
const money = (v: string) => v.trim() !== '' && Number.isFinite(Number(v)) && Number(v) >= 0;

export const txFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Title is required')
      .max(255, 'Keep the title under 255 characters'),
    amount: z.string().trim().refine(positive, 'Enter an amount above 0'),
    kind: z.enum(['expense', 'income']),
    payer: z.enum(['self', 'other']),
    account_id: z.string(),
    payer_person_id: z.string(),
    payer_currency: z.string(),
    category_id: z.string(),
    date: z.string().regex(DATE_RE, 'Date is required'),
    time: z.string().regex(TIME_RE, 'Time is required'),
    notes: z.string().max(2000, 'Keep notes under 2000 characters'),
    split_enabled: z.boolean(),
    splits: z.array(
      z.object({
        person_id: z.string().min(1, 'Pick a person'),
        amount: z.string().trim().refine(positive, 'Enter a share above 0'),
      })
    ),
    participants: z.array(
      z.object({
        name: z.string().trim().min(1, 'Name is required'),
        external_user_id: z.string().optional(),
        paid_share: z.string().refine(money, 'Enter 0 or more'),
        owed_share: z.string().refine(money, 'Enter 0 or more'),
      })
    ),
    /** Index of the user in `participants`, or -1. */
    user_index: z.number().int(),
  })
  .superRefine((v, ctx) => {
    if (v.payer === 'self' && !v.account_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['account_id'],
        message: 'Pick the account it was paid from',
      });
    }
    if (v.payer === 'other' && !v.payer_person_id) {
      ctx.addIssue({ code: 'custom', path: ['payer_person_id'], message: 'Pick who paid' });
    }
    if (DATE_RE.test(v.date) && TIME_RE.test(v.time) && isFuture(v.date, v.time)) {
      ctx.addIssue({ code: 'custom', path: ['date'], message: 'Date cannot be in the future' });
    }
    if (v.payer === 'self' && v.split_enabled) {
      const seen = new Set<string>();
      v.splits.forEach((s, i) => {
        if (s.person_id && seen.has(s.person_id)) {
          ctx.addIssue({
            code: 'custom',
            path: ['splits', i, 'person_id'],
            message: 'This person is already in the split',
          });
        }
        seen.add(s.person_id);
      });
      const others = v.splits.reduce((s, x) => s + (Number(x.amount) || 0), 0);
      if (positive(v.amount) && round2(others) > Number(v.amount)) {
        ctx.addIssue({
          code: 'custom',
          path: ['splits'],
          message: 'Shares cannot add up to more than the amount',
        });
      }
    }
  });

export type TxFormValues = z.infer<typeof txFormSchema>;

export enum TxFormMode {
  Create = 'create',
  Edit = 'edit',
  Duplicate = 'duplicate',
}

export interface TxFormSource {
  mode: TxFormMode;
  /** The transaction being edited or duplicated. */
  tx?: Transaction;
  defaultAccountId?: string;
  /** The currency to preselect for "someone else paid" (the user's default). */
  baseCurrency: string;
  /** For duplicates of paid-by-others rows: the payer's currency. */
  sourceCurrency?: string;
}

const abs = (v: string) => String(Math.abs(toNumber(v)));

/** Match the user's participant by owed share equal to the transaction amount. */
export function findUserIndex(tx: Transaction): number {
  const target = Math.abs(toNumber(tx.amount));
  return (tx.debt_metadata?.expense_participants ?? []).findIndex(
    (p) => Math.abs(toNumber(p.owed_share) - target) < 0.01
  );
}

export function txFormDefaults(src: TxFormSource, now: Date = new Date()): TxFormValues {
  const { mode, tx } = src;
  const blank: TxFormValues = {
    title: '',
    amount: '',
    kind: 'expense',
    payer: 'self',
    account_id: src.defaultAccountId ?? '',
    payer_person_id: '',
    payer_currency: src.baseCurrency,
    category_id: '',
    ...nowParts(now),
    notes: '',
    split_enabled: false,
    splits: [],
    participants: [],
    user_index: -1,
  };
  if (!tx || mode === TxFormMode.Create) return blank;
  const debt = !!tx.debt_metadata;
  const shared = {
    ...blank,
    title: tx.title,
    amount: abs(tx.amount),
    kind: toNumber(tx.amount) >= 0 ? ('income' as const) : ('expense' as const),
    payer: debt ? ('other' as const) : ('self' as const),
    account_id: debt ? '' : tx.account_id,
    payer_person_id: tx.debt_metadata?.payer_person_id ?? '',
    payer_currency: debt ? (src.sourceCurrency ?? src.baseCurrency) : src.baseCurrency,
    category_id: tx.category_id ?? '',
    notes: tx.notes ?? '',
  };
  // Duplicates copy the what, not the when, splits or participants.
  if (mode === TxFormMode.Duplicate) return shared;
  const splits = debt
    ? []
    : (tx.splits ?? []).map((s) => ({ person_id: s.person_id, amount: abs(s.amount) }));
  const participants = (tx.debt_metadata?.expense_participants ?? []).map((p) => ({
    name: p.name,
    external_user_id: p.external_user_id ?? undefined,
    paid_share: p.paid_share,
    owed_share: p.owed_share,
  }));
  return {
    ...shared,
    ...fromApiDateTime(tx.date),
    split_enabled: splits.length > 0,
    splits,
    participants,
    user_index: participants.length ? findUserIndex(tx) : -1,
  };
}

/** Editing a paid-by-others row that carries the full expense breakdown. */
export const hasParticipants = (
  v: Pick<TxFormValues, 'payer' | 'participants'>,
  editing: boolean
) => editing && v.payer === 'other' && v.participants.length > 0;

/** With participants the amount is the user's owed share, not typed. */
export function effectiveAmount(v: TxFormValues, editing: boolean): number {
  if (hasParticipants(v, editing) && v.user_index >= 0 && v.participants[v.user_index]) {
    const share = Number(v.participants[v.user_index].owed_share);
    if (share > 0) return share;
  }
  return Number(v.amount);
}

export type TxSubmitPlan =
  | { kind: 'create'; body: CreateTransactionRequest }
  | { kind: 'createDebt'; body: CreateDebtTransactionRequest }
  | {
      kind: 'update';
      id: string;
      body: CreateTransactionRequest;
      metadata?: UpdateExpenseDetailsRequest;
    };

const opt = (s: string) => (s.trim() ? s.trim() : undefined);

/** Everything the submit needs to do, decided without side effects. */
export function planSubmit(v: TxFormValues, editing?: Transaction): TxSubmitPlan {
  const isEdit = !!editing;
  const size = effectiveAmount(v, isEdit);
  const amount = v.kind === 'income' ? size : -size;
  const date = toApiDateTime(v.date, v.time);
  const core = {
    title: v.title.trim(),
    amount,
    date,
    category_id: opt(v.category_id),
    notes: opt(v.notes),
  };
  if (v.payer === 'other') {
    if (editing) {
      const metadata = hasParticipants(v, true)
        ? {
            total_cost: round2(v.participants.reduce((s, p) => s + (Number(p.owed_share) || 0), 0)),
            expense_participants: v.participants.map((p) => ({
              name: p.name.trim(),
              external_user_id: p.external_user_id || undefined,
              paid_share: p.paid_share,
              owed_share: p.owed_share,
            })),
          }
        : undefined;
      return {
        kind: 'update',
        id: editing.id,
        body: { ...core, account_id: editing.account_id },
        metadata,
      };
    }
    return {
      kind: 'createDebt',
      body: {
        ...core,
        payer_person_id: v.payer_person_id,
        currency: v.payer_currency as CurrencyCode,
      },
    };
  }
  // Splits: an edit that turned splitting off must send [] to clear them.
  const splits = v.split_enabled
    ? v.splits.map((s) => ({ person_id: s.person_id, amount: Number(s.amount) }))
    : isEdit
      ? []
      : undefined;
  const body: CreateTransactionRequest = {
    ...core,
    account_id: v.account_id,
    ...(splits ? { splits } : {}),
  };
  return editing ? { kind: 'update', id: editing.id, body } : { kind: 'create', body };
}
