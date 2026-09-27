import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import {
  BudgetDialog,
  BudgetDialogsContext,
  type BudgetDialogsApi,
  type BudgetDialogState,
} from '../hooks/budgetDialogs';
import { DeleteBudgetDialog, DeleteRangeDialog } from './BudgetConfirmDialogs';

const BudgetFormDialog = lazy(() =>
  import('./BudgetFormDialog').then((m) => ({ default: m.BudgetFormDialog }))
);
const RangeFormDialog = lazy(() =>
  import('./RangeFormDialog').then((m) => ({ default: m.RangeFormDialog }))
);

/** Hosts every budget dialog once; closing keeps the state so the exit animation plays. */
export function BudgetDialogsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BudgetDialogState | null>(null);
  const api = useMemo<BudgetDialogsApi>(() => {
    const show = (s: Omit<BudgetDialogState, 'open' | 'seq'>) =>
      setState((prev) => ({ ...s, open: true, seq: (prev?.seq ?? 0) + 1 }));
    return {
      openCreate: () => show({ kind: BudgetDialog.Form }),
      openEdit: (budget) => show({ kind: BudgetDialog.Form, budget }),
      confirmDelete: (budget, onDone) => show({ kind: BudgetDialog.Delete, budget, onDone }),
      openRange: (budget, range, prev) => show({ kind: BudgetDialog.Range, budget, range, prev }),
      confirmDeleteRange: (budget, range) =>
        show({ kind: BudgetDialog.DeleteRange, budget, range }),
    };
  }, []);
  const onOpenChange = (open: boolean) => {
    if (!open) setState((s) => (s ? { ...s, open: false } : s));
  };
  const key = state ? `${state.kind}:${state.seq}` : '';
  const common = state ? { open: state.open, onOpenChange } : null;
  const b = state?.budget;

  return (
    <BudgetDialogsContext.Provider value={api}>
      {children}
      {state && common ? (
        <Suspense fallback={null}>
          {state.kind === BudgetDialog.Form ? (
            <BudgetFormDialog key={key} {...common} budget={b} />
          ) : null}
          {state.kind === BudgetDialog.Range && b ? (
            <RangeFormDialog
              key={key}
              {...common}
              budget={b}
              range={state.range}
              prev={state.prev}
            />
          ) : null}
        </Suspense>
      ) : null}
      {state && common && b && state.kind === BudgetDialog.Delete ? (
        <DeleteBudgetDialog key={key} {...common} budget={b} onDeleted={state.onDone} />
      ) : null}
      {state && common && b && state.range && state.kind === BudgetDialog.DeleteRange ? (
        <DeleteRangeDialog key={key} {...common} budget={b} range={state.range} />
      ) : null}
    </BudgetDialogsContext.Provider>
  );
}
