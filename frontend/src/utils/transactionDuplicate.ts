import type { EnrichedTransaction, TransactionFormDefaultValues } from '@/types';

/**
 * Build default form values for duplicating a transaction.
 *
 * Copies title, amount (absolute), transaction type, account, category, and notes
 * from the source transaction. Date and time are intentionally NOT copied — the
 * form will default to "now".
 *
 * For debt ("paid by others") transactions, the payer person and currency are
 * pre-filled but expense participants and splits are NOT copied.
 */
export function buildDuplicateDefaults(
  transaction: EnrichedTransaction
): TransactionFormDefaultValues {
  const amount = parseFloat(transaction.amount);
  const isDebt = !!transaction.debt_metadata;

  return {
    title: transaction.title,
    amount: Math.abs(amount).toString(),
    transaction_type: amount >= 0 ? 'income' : 'expense',
    account_id: isDebt ? undefined : transaction.account.id,
    category_id: transaction.category?.id,
    notes: transaction.notes,
    payer_mode: isDebt ? 'other' : 'self',
    payer_person_id: transaction.debt_metadata?.payer_person_id,
    payer_currency: isDebt ? transaction.account.currency : undefined,
  };
}
