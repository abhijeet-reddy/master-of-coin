import { useState, useCallback } from 'react';
import type { TransactionSplitRequest, PayerMode } from '@/types';

interface UseTransactionSplitStateProps {
  transactionType: 'income' | 'expense';
  payerMode: PayerMode;
  isDebtTransaction?: boolean;
}

interface UseTransactionSplitStateReturn {
  isSplitEnabled: boolean;
  splits: TransactionSplitRequest[];
  /** Whether the split toggle/form should be shown */
  canSplit: boolean;
  toggleSplit: () => void;
  setSplits: (splits: TransactionSplitRequest[]) => void;
  clearSplits: () => void;
  /** Re-initialize from existing transaction data (e.g. when editing) */
  initFromTransaction: (splits: TransactionSplitRequest[], isDebt: boolean) => void;
}

/**
 * Manages split payment state for the transaction form.
 *
 * Encapsulates the income-awareness logic:
 * - `canSplit` is false when transaction type is income, payer mode is 'other', or it's a debt transaction
 * - The component uses `canSplit` to conditionally render the split toggle/form
 * - When `canSplit` is false, splits are simply hidden (not sent on submit)
 *
 * CONSTRAINT: Uses exactly 2 useState hooks (within hook limits)
 */
export default function useTransactionSplitState({
  transactionType,
  payerMode,
  isDebtTransaction = false,
}: UseTransactionSplitStateProps): UseTransactionSplitStateReturn {
  const [isSplitEnabled, setIsSplitEnabled] = useState(false);
  const [splits, setSplits] = useState<TransactionSplitRequest[]>([]);

  const canSplit = transactionType === 'expense' && payerMode === 'self' && !isDebtTransaction;

  const clearSplits = useCallback(() => {
    setIsSplitEnabled(false);
    setSplits([]);
  }, []);

  const toggleSplit = useCallback(() => {
    setIsSplitEnabled((prev) => {
      if (prev) {
        setSplits([]);
      }
      return !prev;
    });
  }, []);

  const initFromTransaction = useCallback(
    (existingSplits: TransactionSplitRequest[], isDebt: boolean) => {
      if (!isDebt && existingSplits.length > 0) {
        setIsSplitEnabled(true);
        setSplits(existingSplits);
      } else {
        setIsSplitEnabled(false);
        setSplits(isDebt ? [] : existingSplits);
      }
    },
    []
  );

  return {
    isSplitEnabled,
    splits,
    canSplit,
    toggleSplit,
    setSplits,
    clearSplits,
    initFromTransaction,
  };
}
