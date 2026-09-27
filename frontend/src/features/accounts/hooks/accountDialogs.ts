/** Which account dialog is open, shared by the list, the cards and the detail page. */
import { createContext, useContext } from 'react';
import type { Account, AccountType } from '@/api/types';

export enum AccountDialog {
  Form = 'form',
  Archive = 'archive',
  Delete = 'delete',
  Connect = 'connect',
  Balance = 'balance',
}

export interface AccountDialogState {
  kind: AccountDialog;
  open: boolean;
  account?: Account;
  /** Create only: preselect a type (the "Add savings" slots). */
  type?: AccountType;
  onDone?: () => void;
  seq: number;
}

export interface AccountDialogsApi {
  openCreate: (type?: AccountType) => void;
  openEdit: (account: Account) => void;
  /** Archive or unarchive, whichever applies. */
  confirmArchive: (account: Account) => void;
  confirmDelete: (account: Account, onDeleted?: () => void) => void;
  /** No account: pick one first. */
  openConnect: (account?: Account) => void;
  openBalance: (account: Account) => void;
}

export const AccountDialogsContext = createContext<AccountDialogsApi | null>(null);

export function useAccountDialogs(): AccountDialogsApi {
  const ctx = useContext(AccountDialogsContext);
  if (!ctx) throw new Error('useAccountDialogs needs an <AccountDialogsProvider>');
  return ctx;
}
