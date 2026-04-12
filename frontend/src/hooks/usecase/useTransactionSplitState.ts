import { useState, useCallback } from 'react';
import type { TransactionSplitRequest, PayerMode } from '@/types';

interface UseTransactionSplitStateProps {
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
 * - `canSplit` is false when payer mode is 'other' or it's a debt transaction
 * - The component uses `canSplit` to conditionally render the split toggle/form
 * - When `canSplit` is false, splits are simply hidden (not sent on submit)
 * - Splits are allowed on both income and expense transactions
 *
 * CONSTRAINT: Uses exactly 2 useState hooks (within hook limits)
 */
export default function useTransactionSplitState({
  payerMode,
  isDebtTransaction = false,
}: UseTransactionSplitStateProps): UseTransactionSplitStateReturn {
  const [isSplitEnabled, setIsSplitEnabled] = useState(false);
  const [splits, setSplits] = useState<TransactionSplitRequest[]>([]);

  const canSplit = payerMode === 'self' && !isDebtTransaction;

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
      // Normalize split amounts to absolute values for the form UI.
      // The backend stores signed amounts (negative for income splits),
      // but the form always works with positive values.
      const normalizedSplits = existingSplits.map((s) => ({
        ...s,
        amount: Math.abs(parseFloat(s.amount) || 0).toString(),
      }));

      if (!isDebt && normalizedSplits.length > 0) {
        setIsSplitEnabled(true);
        setSplits(normalizedSplits);
      } else {
        setIsSplitEnabled(false);
        setSplits(isDebt ? [] : normalizedSplits);
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
