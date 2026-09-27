import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import {
  PersonDialog,
  PeopleDialogsContext,
  type PeopleDialogsApi,
  type PersonDialogState,
} from '../hooks/peopleDialogs';
import { DeletePersonDialog } from './DeletePersonDialog';

const PersonFormDialog = lazy(() =>
  import('./PersonFormDialog').then((m) => ({ default: m.PersonFormDialog }))
);
const SettleDialog = lazy(() =>
  import('./SettleDialog').then((m) => ({ default: m.SettleDialog }))
);
const SplitLinkDialog = lazy(() =>
  import('./SplitLinkDialog').then((m) => ({ default: m.SplitLinkDialog }))
);

/** Hosts every person dialog once; closing keeps the state so the exit animation plays. */
export function PeopleDialogsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersonDialogState | null>(null);
  const api = useMemo<PeopleDialogsApi>(() => {
    const show = (s: Omit<PersonDialogState, 'open' | 'seq'>) =>
      setState((prev) => ({ ...s, open: true, seq: (prev?.seq ?? 0) + 1 }));
    return {
      openCreate: () => show({ kind: PersonDialog.Form }),
      openEdit: (person) => show({ kind: PersonDialog.Form, person }),
      confirmDelete: (person, onDone) => show({ kind: PersonDialog.Delete, person, onDone }),
      openSettle: (person) => show({ kind: PersonDialog.Settle, person }),
      openLink: (person) => show({ kind: PersonDialog.Link, person }),
    };
  }, []);
  const onOpenChange = (open: boolean) => {
    if (!open) setState((s) => (s ? { ...s, open: false } : s));
  };
  const key = state ? `${state.kind}:${state.seq}` : '';
  const p = state?.person;

  return (
    <PeopleDialogsContext.Provider value={api}>
      {children}
      <Suspense fallback={null}>
        {state?.kind === PersonDialog.Form ? (
          <PersonFormDialog key={key} open={state.open} onOpenChange={onOpenChange} person={p} />
        ) : null}
        {state?.kind === PersonDialog.Settle && p ? (
          <SettleDialog key={key} open={state.open} onOpenChange={onOpenChange} person={p} />
        ) : null}
        {state?.kind === PersonDialog.Link && p ? (
          <SplitLinkDialog key={key} open={state.open} onOpenChange={onOpenChange} person={p} />
        ) : null}
      </Suspense>
      {state?.kind === PersonDialog.Delete && p ? (
        <DeletePersonDialog
          key={key}
          open={state.open}
          onOpenChange={onOpenChange}
          person={p}
          onDeleted={state.onDone}
        />
      ) : null}
    </PeopleDialogsContext.Provider>
  );
}
