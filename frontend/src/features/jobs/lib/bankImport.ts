/** Turn a bank sync report into rows for the transactions import review. */
import type { BankSyncMetadata, ParsedTransaction } from '@/api/types';
import type { BankSyncReport, FetchedBankTransaction } from '@/api/types/bankProvider';

/** Same title rule as the backend: the description, prefixed by the merchant when it is not in it. */
export function bankTitle(txn: Pick<FetchedBankTransaction, 'description' | 'merchant_name'>) {
  const m = txn.merchant_name?.trim();
  if (!m || txn.description.includes(m)) return txn.description;
  return `${m} - ${txn.description}`;
}

export function bankTxnToParsed(txn: FetchedBankTransaction): ParsedTransaction {
  const n = parseFloat(txn.amount);
  return {
    temp_id: txn.external_id,
    title: bankTitle(txn),
    amount: Number.isFinite(n) ? n.toFixed(2) : txn.amount,
    date: txn.date,
    is_valid: true,
    is_potential_duplicate: false,
  };
}

export interface BankImportPreload {
  rows: ParsedTransaction[];
  accountId: string;
  metadata: BankSyncMetadata;
}

/**
 * Rows not yet imported, with metadata parallel to them. The import keys metadata by row, so
 * editing a title or amount in the review keeps the bank link.
 */
export function bankImportPreload(report: BankSyncReport): BankImportPreload | null {
  const fresh = report.transactions.filter((t) => !t.already_imported);
  if (fresh.length === 0) return null;
  return {
    rows: fresh.map(bankTxnToParsed),
    accountId: report.account_id,
    metadata: {
      bank_provider_id: report.bank_provider_id,
      external_transaction_ids: fresh.map((t) => t.external_id),
    },
  };
}
