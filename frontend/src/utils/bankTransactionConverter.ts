/**
 * Utility functions to convert bank sync transactions to the format
 * expected by TransactionPreviewStep (same as CSV import).
 */

import type { FetchedBankTransaction } from '@/types/bankProvider';
import type { ParsedTransaction, BankSyncMetadata } from '@/types';

/**
 * Convert a FetchedBankTransaction to a ParsedTransaction for the preview step.
 *
 * Maps external_id → temp_id, builds title from description/merchant,
 * converts amount to signed string based on transaction_type.
 */
export function bankTxnToParsed(txn: FetchedBankTransaction): ParsedTransaction {
  // The bank amount is already signed correctly (negative for debits, positive for credits)
  const amount = parseFloat(txn.amount);

  // Build title from description and merchant (same logic as backend)
  let title: string;
  if (txn.merchant_name) {
    if (txn.description.includes(txn.merchant_name)) {
      title = txn.description;
    } else {
      title = `${txn.merchant_name} - ${txn.description}`;
    }
  } else {
    title = txn.description;
  }

  return {
    temp_id: txn.external_id,
    title,
    amount: amount.toFixed(2),
    date: txn.date,
    is_valid: true,
    is_potential_duplicate: false,
  };
}

/**
 * Build BankSyncMetadata from a bank provider ID and selected transactions.
 *
 * The external_transaction_ids array will be parallel to the transactions
 * passed to bulk-create.
 */
export function buildBankSyncMetadata(
  bankProviderId: string,
  transactions: FetchedBankTransaction[]
): BankSyncMetadata {
  return {
    bank_provider_id: bankProviderId,
    external_transaction_ids: transactions.map((t) => t.external_id),
  };
}
