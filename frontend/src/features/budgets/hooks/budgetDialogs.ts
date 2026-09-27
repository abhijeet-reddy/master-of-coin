/** Which budget dialog is open, shared by the list, the cards and the detail page. */
import { createContext, useContext } from 'react';
import type { Budget, BudgetRange } from '@/api/types';

export enum BudgetDialog {
  Form = 'form',
  Delete = 'delete',
  Range = 'range',
  DeleteRange = 'delete-range',
}

export interface BudgetDialogState {
  kind: BudgetDialog;
  open: boolean;
  budget?: Budget;
  range?: BudgetRange;
  /** Range dialog, adding: the range to prefill from. */
  prev?: BudgetRange;
  onDone?: () => void;
  seq: number;
}

export interface BudgetDialogsApi {
  openCreate: () => void;
  openEdit: (budget: Budget) => void;
  confirmDelete: (budget: Budget, onDeleted?: () => void) => void;
  /** No range: add one, prefilled from `prev`. */
  openRange: (budget: Budget, range?: BudgetRange, prev?: BudgetRange) => void;
  confirmDeleteRange: (budget: Budget, range: BudgetRange) => void;
}

export const BudgetDialogsContext = createContext<BudgetDialogsApi | null>(null);

export function useBudgetDialogs(): BudgetDialogsApi {
  const ctx = useContext(BudgetDialogsContext);
  if (!ctx) throw new Error('useBudgetDialogs needs a <BudgetDialogsProvider>');
  return ctx;
}
