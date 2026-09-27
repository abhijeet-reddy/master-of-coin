import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import { TxFormMode } from '../../forms/transactionForm';
import {
  TxDialog,
  TxDialogsContext,
  type TxDialogsApi,
  type TxDialogState,
} from '../../hooks/txDialogs';
import { DeleteTransactionDialog } from './DeleteTransactionDialog';

const TransactionFormDialog = lazy(() =>
  import('./TransactionFormDialog').then((m) => ({ default: m.TransactionFormDialog }))
);
const TransferDialog = lazy(() =>
  import('./TransferDialog').then((m) => ({ default: m.TransferDialog }))
);
const ConvertDialog = lazy(() =>
  import('./ConvertDialog').then((m) => ({ default: m.ConvertDialog }))
);
const ImportDialog = lazy(() =>
  import('./ImportDialog').then((m) => ({ default: m.ImportDialog }))
);

const FORM_MODE: Partial<Record<TxDialog, TxFormMode>> = {
  [TxDialog.Create]: TxFormMode.Create,
  [TxDialog.Edit]: TxFormMode.Edit,
  [TxDialog.Duplicate]: TxFormMode.Duplicate,
};

/**
 * Hosts every transaction dialog once. Closing keeps the last state so the
 * exit animation plays; the dialogs load on first use.
 */
export function TxDialogsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TxDialogState | null>(null);

  const api = useMemo<TxDialogsApi>(() => {
    const show = (s: Omit<TxDialogState, 'open' | 'seq'>) =>
      setState((prev) => ({ ...s, open: true, seq: (prev?.seq ?? 0) + 1 }));
    return {
      openCreate: (accountId) => show({ kind: TxDialog.Create, accountId }),
      openEdit: (tx) => show({ kind: TxDialog.Edit, tx }),
      openDuplicate: (tx) => show({ kind: TxDialog.Duplicate, tx }),
      openTransfer: (accountId) => show({ kind: TxDialog.Transfer, accountId }),
      openConvert: (tx) => show({ kind: TxDialog.Convert, tx }),
      openImport: (accountId) => show({ kind: TxDialog.Import, accountId }),
      confirmDelete: (tx, onDone) => show({ kind: TxDialog.Delete, tx, onDone }),
    };
  }, []);

  const onOpenChange = (open: boolean) => {
    if (!open) setState((s) => (s ? { ...s, open: false } : s));
  };
  const mode = state ? FORM_MODE[state.kind] : undefined;
  // A new key per opening resets the form inside.
  const key = state ? `${state.kind}:${state.seq}` : '';

  return (
    <TxDialogsContext.Provider value={api}>
      {children}
      {state ? (
        <Suspense fallback={null}>
          {mode ? (
            <TransactionFormDialog
              key={key}
              open={state.open}
              onOpenChange={onOpenChange}
              source={{ mode, tx: state.tx, defaultAccountId: state.accountId }}
            />
          ) : null}
          {state.kind === TxDialog.Transfer ? (
            <TransferDialog
              key={key}
              open={state.open}
              onOpenChange={onOpenChange}
              fromAccountId={state.accountId}
            />
          ) : null}
          {state.kind === TxDialog.Convert && state.tx ? (
            <ConvertDialog key={key} open={state.open} onOpenChange={onOpenChange} tx={state.tx} />
          ) : null}
          {state.kind === TxDialog.Import ? (
            <ImportDialog
              key={key}
              open={state.open}
              onOpenChange={onOpenChange}
              accountId={state.accountId}
            />
          ) : null}
          {state.kind === TxDialog.Delete && state.tx ? (
            <DeleteTransactionDialog
              key={key}
              open={state.open}
              onOpenChange={onOpenChange}
              tx={state.tx}
              onDeleted={state.onDone}
            />
          ) : null}
        </Suspense>
      ) : null}
    </TxDialogsContext.Provider>
  );
}
