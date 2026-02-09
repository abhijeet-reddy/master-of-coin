/** Transaction import utility functions */

import type { ParsedTransaction, ImportSummary } from '@/types';

/**
 * Calculate summary statistics for transactions
 */
export const calculateTransactionSummary = (
  transactions: ParsedTransaction[],
  selectedIds: Set<string>
): ImportSummary => {
  const selected = transactions.filter((t) => selectedIds.has(t.temp_id));

  const summary = selected.reduce(
    (acc, transaction) => {
      const amount = parseFloat(transaction.amount);

      if (amount > 0) {
        acc.income += amount;
      } else {
        acc.expenses += Math.abs(amount);
      }

      if (transaction.is_potential_duplicate) {
        acc.duplicates += 1;
      }

      if (!transaction.is_valid) {
        acc.invalid += 1;
      }

      return acc;
    },
    { total: selected.length, income: 0, expenses: 0, duplicates: 0, invalid: 0 }
  );

  return summary;
};

/**
 * Get confidence level color for badges
 */
export const getConfidenceColor = (
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
): 'red' | 'yellow' | 'orange' => {
  switch (confidence) {
    case 'HIGH':
      return 'red';
    case 'MEDIUM':
      return 'orange';
    case 'LOW':
      return 'yellow';
  }
};

/**
 * Format amount for display
 */
export const formatAmount = (amount: string | number): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return num.toFixed(2);
};
