import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import {
  CategoryDialog,
  CategoryDialogsContext,
  type CategoryDialogsApi,
  type CategoryDialogState,
} from '../hooks/categoryDialogs';
import { DeleteCategoryDialog } from './DeleteCategoryDialog';

const CategoryFormDialog = lazy(() =>
  import('./CategoryFormDialog').then((m) => ({ default: m.CategoryFormDialog }))
);

/** Hosts every category dialog once; closing keeps the state so the exit animation plays. */
export function CategoryDialogsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CategoryDialogState | null>(null);
  const api = useMemo<CategoryDialogsApi>(() => {
    const show = (s: Omit<CategoryDialogState, 'open' | 'seq'>) =>
      setState((prev) => ({ ...s, open: true, seq: (prev?.seq ?? 0) + 1 }));
    return {
      openCreate: () => show({ kind: CategoryDialog.Form }),
      openEdit: (category) => show({ kind: CategoryDialog.Form, category }),
      confirmDelete: (category, onDone) => show({ kind: CategoryDialog.Delete, category, onDone }),
    };
  }, []);
  const onOpenChange = (open: boolean) => {
    if (!open) setState((s) => (s ? { ...s, open: false } : s));
  };
  const key = state ? `${state.kind}:${state.seq}` : '';
  const c = state?.category;

  return (
    <CategoryDialogsContext.Provider value={api}>
      {children}
      {state?.kind === CategoryDialog.Form ? (
        <Suspense fallback={null}>
          <CategoryFormDialog
            key={key}
            open={state.open}
            onOpenChange={onOpenChange}
            category={c}
          />
        </Suspense>
      ) : null}
      {state?.kind === CategoryDialog.Delete && c ? (
        <DeleteCategoryDialog
          key={key}
          open={state.open}
          onOpenChange={onOpenChange}
          category={c}
          onDeleted={state.onDone}
        />
      ) : null}
    </CategoryDialogsContext.Provider>
  );
}
