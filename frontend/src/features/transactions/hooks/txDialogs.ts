/** Which transaction dialog is open, shared by the page, the drawer, the detail page and the dashboard. */
import { createContext, useContext } from 'react';
import type { Transaction } from '@/api/types';

export enum TxDialog {
  Create = 'create',
  Edit = 'edit',
  Duplicate = 'duplicate',
  Transfer = 'transfer',
  Convert = 'convert',
  Import = 'import',
  Delete = 'delete',
}

export interface TxDialogState {
  kind: TxDialog;
  open: boolean;
  tx?: Transaction;
  accountId?: string;
  onDone?: () => void;
  /** Bumped per opening so reopening the same dialog starts fresh. */
  seq: number;
}

export interface TxDialogsApi {
  openCreate: (accountId?: string) => void;
  openEdit: (tx: Transaction) => void;
  openDuplicate: (tx: Transaction) => void;
  openTransfer: (accountId?: string) => void;
  openConvert: (tx: Transaction) => void;
  openImport: (accountId?: string) => void;
  /** `onDeleted` runs after the delete succeeds (e.g. leave the detail page). */
  confirmDelete: (tx: Transaction, onDeleted?: () => void) => void;
}

export const TxDialogsContext = createContext<TxDialogsApi | null>(null);

export function useTxDialogs(): TxDialogsApi {
  const ctx = useContext(TxDialogsContext);
  if (!ctx) throw new Error('useTxDialogs needs a <TxDialogsProvider>');
  return ctx;
}
