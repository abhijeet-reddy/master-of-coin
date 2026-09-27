import { describe, expect, it } from 'vitest';
import type { ParsedTransaction } from '@/api/types';
import {
  applyEdits,
  buildBulkRequest,
  defaultSelection,
  importSummary,
  rowProblem,
} from '@/features/transactions/lib/importModel';

const row = (
  temp_id: string,
  amount: string,
  p: Partial<ParsedTransaction> = {}
): ParsedTransaction => ({
  temp_id,
  title: `Row ${temp_id}`,
  amount,
  date: '2026-09-20',
  is_valid: true,
  is_potential_duplicate: false,
  ...p,
});

const rows = [
  row('a', '-10.00'),
  row('b', '250.00'),
  row('c', '-4.50', { is_potential_duplicate: true }),
  row('d', 'abc', { is_valid: false, validation_errors: ['Bad amount'] }),
];

describe('selection', () => {
  it('starts with valid, non-duplicate rows ticked', () => {
    expect([...defaultSelection(rows)]).toEqual(['a', 'b']);
  });
});

describe('importSummary', () => {
  it('totals only the selected rows', () => {
    expect(importSummary(rows, new Set(['a', 'b']))).toEqual({
      total: 2,
      income: 250,
      expenses: 10,
      duplicates: 0,
      invalid: 0,
    });
  });

  it('reflects edits: a changed amount or sign moves the totals', () => {
    const edited = applyEdits(rows, { a: { amount: '-12.25' }, b: { amount: '-50' } });
    expect(importSummary(edited, new Set(['a', 'b']))).toMatchObject({
      income: 0,
      expenses: 62.25,
    });
  });

  it('counts duplicates and invalid rows among the selection', () => {
    const s = importSummary(applyEdits(rows, { a: { title: '  ' } }), new Set(['a', 'c', 'd']));
    expect(s.duplicates).toBe(1);
    expect(s.invalid).toBe(2);
  });
});

describe('rowProblem', () => {
  it('names the first problem after editing', () => {
    expect(rowProblem(row('x', '1'))).toBeNull();
    expect(rowProblem(row('x', '1', { title: '' }))).toBe('Title is required');
    expect(rowProblem(row('x', ''))).toBe('Amount is not a number');
    expect(rowProblem(row('x', '1', { date: 'soon' }))).toBe('Date is not valid');
  });
});

describe('buildBulkRequest', () => {
  const meta = {
    bank_provider_id: 'bp',
    external_transaction_ids: ['ext-a', 'ext-b', 'ext-c', 'ext-d'],
  };

  it('sends edited values for the selected rows in their original order', () => {
    const req = buildBulkRequest(
      'acc',
      rows,
      { b: { title: ' Salary ', notes: ' Sept ' } },
      new Set(['b', 'a'])
    );
    expect(req.account_id).toBe('acc');
    expect(req.transactions).toEqual([
      { account_id: 'acc', title: 'Row a', amount: -10, date: '2026-09-20' },
      { account_id: 'acc', title: 'Salary', amount: 250, date: '2026-09-20', notes: 'Sept' },
    ]);
    expect(req.bank_sync_metadata).toBeUndefined();
  });

  it('keeps bank sync metadata parallel to the chosen rows after editing', () => {
    const req = buildBulkRequest(
      'acc',
      rows,
      { c: { title: 'Coffee', amount: '-4.80' }, a: { amount: '-11' } },
      new Set(['a', 'c']),
      meta
    );
    expect(req.transactions.map((t) => t.title)).toEqual(['Row a', 'Coffee']);
    expect(req.transactions.map((t) => t.amount)).toEqual([-11, -4.8]);
    expect(req.bank_sync_metadata).toEqual({
      bank_provider_id: 'bp',
      external_transaction_ids: ['ext-a', 'ext-c'],
    });
  });

  it('drops the metadata rather than misaligning it when an id is missing', () => {
    const partial = { bank_provider_id: 'bp', external_transaction_ids: ['ext-a'] };
    const req = buildBulkRequest('acc', rows, {}, new Set(['a', 'b']), partial);
    expect(req.bank_sync_metadata).toBeUndefined();
  });
});
