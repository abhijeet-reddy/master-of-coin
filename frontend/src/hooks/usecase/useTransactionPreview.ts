/** Custom hook for managing transaction preview state */

import { useState, useCallback, useMemo } from 'react';
import type { ParsedTransaction } from '@/types';

interface UseTransactionPreviewReturn {
  selectedTransactions: Set<string>;
  editedTransactions: Map<string, Partial<ParsedTransaction>>;
  toggleTransaction: (tempId: string) => void;
  toggleAll: () => void;
  updateTransaction: (tempId: string, updates: Partial<ParsedTransaction>) => void;
  deleteTransaction: (tempId: string) => void;
  isAllSelected: boolean;
  selectedCount: number;
  getTransactionData: (tempId: string, original: ParsedTransaction) => ParsedTransaction;
}

export const useTransactionPreview = (
  transactions: ParsedTransaction[]
): UseTransactionPreviewReturn => {
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(
    () =>
      new Set(
        transactions.filter((t) => t.is_valid && !t.is_potential_duplicate).map((t) => t.temp_id)
      )
  );
  const [editedTransactions, setEditedTransactions] = useState<
    Map<string, Partial<ParsedTransaction>>
  >(new Map());

  const toggleTransaction = useCallback((tempId: string) => {
    setSelectedTransactions((prev) => {
      const next = new Set(prev);
      if (next.has(tempId)) {
        next.delete(tempId);
      } else {
        next.add(tempId);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedTransactions((prev) => {
      if (prev.size === transactions.length) {
        return new Set();
      }
      return new Set(transactions.map((t) => t.temp_id));
    });
  }, [transactions]);

  const updateTransaction = useCallback((tempId: string, updates: Partial<ParsedTransaction>) => {
    setEditedTransactions((prev) => {
      const next = new Map(prev);
      const existing = next.get(tempId) || {};
      next.set(tempId, { ...existing, ...updates });
      return next;
    });
  }, []);

  const deleteTransaction = useCallback((tempId: string) => {
    setSelectedTransactions((prev) => {
      const next = new Set(prev);
      next.delete(tempId);
      return next;
    });
  }, []);

  const isAllSelected = useMemo(
    () => transactions.length > 0 && selectedTransactions.size === transactions.length,
    [transactions.length, selectedTransactions.size]
  );

  const selectedCount = selectedTransactions.size;

  const getTransactionData = useCallback(
    (tempId: string, original: ParsedTransaction): ParsedTransaction => {
      const edits = editedTransactions.get(tempId);
      return edits ? { ...original, ...edits } : original;
    },
    [editedTransactions]
  );

  return {
    selectedTransactions,
    editedTransactions,
    toggleTransaction,
    toggleAll,
    updateTransaction,
    deleteTransaction,
    isAllSelected,
    selectedCount,
    getTransactionData,
  };
};
