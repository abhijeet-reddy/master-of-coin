import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Transaction } from '@/api/types';
import {
  planSubmit,
  txFormDefaults,
  txFormSchema,
  TxFormMode,
  type TxFormValues,
} from '@/features/transactions/forms/transactionForm';

const saved = process.env.TZ;
process.env.TZ = 'Asia/Kolkata';
beforeAll(() => {
  process.env.TZ = 'Asia/Kolkata';
});
afterAll(() => {
  process.env.TZ = saved;
});

const now = new Date(2026, 8, 27, 12, 0);
const base = (p: Partial<TxFormValues> = {}): TxFormValues => ({
  ...txFormDefaults({ mode: TxFormMode.Create, baseCurrency: 'EUR', defaultAccountId: 'acc' }, now),
  title: 'Lunch',
  amount: '30',
  date: '2026-09-25',
  time: '13:00',
  ...p,
});
const existing: Transaction = {
  id: 't1',
  user_id: 'u',
  account_id: 'acc',
  title: 'Dinner',
  amount: '-30.00',
  date: '2026-09-24T14:30:00Z',
  splits: [
    { id: 's', person_id: 'p1', person_name: 'Sam', amount: '10.00' },
  ] as Transaction['splits'],
  created_at: '',
  updated_at: '',
};

describe('txFormDefaults', () => {
  it('edit shows the stored instant in local time with splits', () => {
    const v = txFormDefaults({ mode: TxFormMode.Edit, tx: existing, baseCurrency: 'EUR' }, now);
    // 14:30 UTC is 20:00 in India.
    expect(v).toMatchObject({
      date: '2026-09-24',
      time: '20:00',
      amount: '30',
      kind: 'expense',
      split_enabled: true,
    });
    expect(v.splits).toEqual([{ person_id: 'p1', amount: '10' }]);
  });
  it('duplicate copies the what, not the when or the splits', () => {
    const v = txFormDefaults(
      { mode: TxFormMode.Duplicate, tx: existing, baseCurrency: 'EUR' },
      now
    );
    expect(v).toMatchObject({
      title: 'Dinner',
      date: '2026-09-27',
      time: '12:00',
      split_enabled: false,
      splits: [],
    });
  });
});

describe('txFormSchema', () => {
  it('rejects a split whose shares exceed the amount', () => {
    const r = txFormSchema.safeParse(
      base({ split_enabled: true, splits: [{ person_id: 'p1', amount: '40' }] })
    );
    expect(r.success).toBe(false);
  });
  it('requires an account when you paid', () => {
    expect(txFormSchema.safeParse(base({ account_id: '' })).success).toBe(false);
  });
});

describe('planSubmit', () => {
  it('creates an expense with a negative amount and the local time as UTC', () => {
    const plan = planSubmit(base());
    expect(plan.kind).toBe('create');
    expect(plan.body).toMatchObject({
      title: 'Lunch',
      amount: -30,
      account_id: 'acc',
      date: '2026-09-25T07:30:00.000Z',
    });
    expect('splits' in plan.body).toBe(false);
  });
  it('an edit that turns splitting off clears the splits', () => {
    const v = txFormDefaults({ mode: TxFormMode.Edit, tx: existing, baseCurrency: 'EUR' }, now);
    const plan = planSubmit({ ...v, split_enabled: false }, existing);
    expect(plan).toMatchObject({ kind: 'update', id: 't1', body: { splits: [] } });
  });
  it('someone else paying creates a debt transaction in their currency', () => {
    const plan = planSubmit(
      base({ payer: 'other', payer_person_id: 'p1', payer_currency: 'GBP', account_id: '' })
    );
    expect(plan).toMatchObject({
      kind: 'createDebt',
      body: { payer_person_id: 'p1', currency: 'GBP', amount: -30 },
    });
  });
  it('income keeps a positive amount', () => {
    expect(planSubmit(base({ kind: 'income' })).body.amount).toBe(30);
  });
});
