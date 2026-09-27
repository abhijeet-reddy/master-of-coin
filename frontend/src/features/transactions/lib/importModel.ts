/**
 * CSV and bank-sync import, pure parts. Rows are keyed by `temp_id` end to
 * end: edits, selection, the summary and the bank sync metadata all follow
 * the id, so editing a row's title or amount neither drops it from the
 * summary nor unlinks it from its bank transaction (both v1 bugs).
 */
import type {
  BankSyncMetadata,
  BulkCreateRequest,
  ImportSummary,
  ParsedTransaction,
} from '@/api/types';
import { toNumber } from '@/lib/format';
import { round2 } from './ledger';

export type RowEdit = Partial<
  Pick<ParsedTransaction, 'title' | 'amount' | 'date' | 'category_id' | 'notes'>
>;
export type RowEdits = Readonly<Record<string, RowEdit>>;

/** The rows as the user sees them: originals with edits laid over. */
export function applyEdits(
  rows: readonly ParsedTransaction[],
  edits: RowEdits
): ParsedTransaction[] {
  return rows.map((r) => (edits[r.temp_id] ? { ...r, ...edits[r.temp_id] } : r));
}

/** Valid, non-duplicate rows start selected. */
export function defaultSelection(rows: readonly ParsedTransaction[]): Set<string> {
  return new Set(rows.filter((r) => r.is_valid && !r.is_potential_duplicate).map((r) => r.temp_id));
}

/** Totals of the SELECTED rows, computed from the EDITED values. */
export function importSummary(
  rows: readonly ParsedTransaction[],
  selected: ReadonlySet<string>
): ImportSummary {
  const out = { total: 0, income: 0, expenses: 0, duplicates: 0, invalid: 0 };
  for (const r of rows) {
    if (!selected.has(r.temp_id)) continue;
    const n = toNumber(r.amount);
    out.total += 1;
    if (Number.isFinite(n)) {
      if (n > 0) out.income += n;
      else out.expenses += Math.abs(n);
    }
    if (r.is_potential_duplicate) out.duplicates += 1;
    if (!r.is_valid || !Number.isFinite(n) || !r.title.trim()) out.invalid += 1;
  }
  return { ...out, income: round2(out.income), expenses: round2(out.expenses) };
}

/** Row-level problems after editing: empty title, bad amount, bad date. */
export function rowProblem(r: ParsedTransaction): string | null {
  if (!r.title.trim()) return 'Title is required';
  if (!Number.isFinite(Number(r.amount)) || r.amount.trim() === '') return 'Amount is not a number';
  if (!/^\d{4}-\d{2}-\d{2}/.test(r.date)) return 'Date is not valid';
  return null;
}

/**
 * The bulk-create request for the selected rows, in their original order.
 * `bank_sync_metadata.external_transaction_ids` must stay parallel to
 * `transactions`, so each selected row's external id is looked up by its
 * temp_id (the metadata list is parallel to the ORIGINAL rows).
 */
export function buildBulkRequest(
  accountId: string,
  original: readonly ParsedTransaction[],
  edits: RowEdits,
  selected: ReadonlySet<string>,
  metadata?: BankSyncMetadata
): BulkCreateRequest {
  const externalByTemp = new Map<string, string>();
  if (metadata) {
    original.forEach((r, i) => {
      const ext = metadata.external_transaction_ids[i];
      if (ext) externalByTemp.set(r.temp_id, ext);
    });
  }
  const chosen = applyEdits(original, edits).filter((r) => selected.has(r.temp_id));
  const request: BulkCreateRequest = {
    account_id: accountId,
    transactions: chosen.map((r) => ({
      account_id: accountId,
      title: r.title.trim(),
      amount: Number(r.amount),
      date: r.date,
      ...(r.category_id ? { category_id: r.category_id } : {}),
      ...(r.notes?.trim() ? { notes: r.notes.trim() } : {}),
    })),
  };
  if (metadata) {
    const ids = chosen.map((r) => externalByTemp.get(r.temp_id));
    if (ids.every((x): x is string => !!x)) {
      request.bank_sync_metadata = {
        bank_provider_id: metadata.bank_provider_id,
        external_transaction_ids: ids,
      };
    }
  }
  return request;
}
