import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import {
  AccountDialog,
  AccountDialogsContext,
  type AccountDialogsApi,
  type AccountDialogState,
} from '../hooks/accountDialogs';
import { ArchiveAccountDialog, DeleteAccountDialog } from './AccountConfirmDialogs';

const AccountFormDialog = lazy(() =>
  import('./AccountFormDialog').then((m) => ({ default: m.AccountFormDialog }))
);
const ConnectDialog = lazy(() =>
  import('./ConnectDialog').then((m) => ({ default: m.ConnectDialog }))
);
const BalanceDialog = lazy(() =>
  import('./BalanceDialog').then((m) => ({ default: m.BalanceDialog }))
);

/** Hosts every account dialog once; closing keeps the state so the exit animation plays. */
export function AccountDialogsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AccountDialogState | null>(null);
  const api = useMemo<AccountDialogsApi>(() => {
    const show = (s: Omit<AccountDialogState, 'open' | 'seq'>) =>
      setState((prev) => ({ ...s, open: true, seq: (prev?.seq ?? 0) + 1 }));
    return {
      openCreate: (type) => show({ kind: AccountDialog.Form, type }),
      openEdit: (account) => show({ kind: AccountDialog.Form, account }),
      confirmArchive: (account) => show({ kind: AccountDialog.Archive, account }),
      confirmDelete: (account, onDone) => show({ kind: AccountDialog.Delete, account, onDone }),
      openConnect: (account) => show({ kind: AccountDialog.Connect, account }),
      openBalance: (account) => show({ kind: AccountDialog.Balance, account }),
    };
  }, []);
  const onOpenChange = (open: boolean) => {
    if (!open) setState((s) => (s ? { ...s, open: false } : s));
  };
  const key = state ? `${state.kind}:${state.seq}` : '';
  const common = state ? { open: state.open, onOpenChange } : null;

  return (
    <AccountDialogsContext.Provider value={api}>
      {children}
      {state && common ? (
        <Suspense fallback={null}>
          {state.kind === AccountDialog.Form ? (
            <AccountFormDialog key={key} {...common} account={state.account} type={state.type} />
          ) : null}
          {state.kind === AccountDialog.Connect ? (
            <ConnectDialog key={key} {...common} account={state.account} />
          ) : null}
          {state.kind === AccountDialog.Balance && state.account ? (
            <BalanceDialog key={key} {...common} account={state.account} />
          ) : null}
        </Suspense>
      ) : null}
      {state && common && state.account && state.kind === AccountDialog.Archive ? (
        <ArchiveAccountDialog key={key} {...common} account={state.account} />
      ) : null}
      {state && common && state.account && state.kind === AccountDialog.Delete ? (
        <DeleteAccountDialog
          key={key}
          {...common}
          account={state.account}
          onDeleted={state.onDone}
        />
      ) : null}
    </AccountDialogsContext.Provider>
  );
}
