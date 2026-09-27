import { useState, type ReactNode } from 'react';
import type { Schedule } from '@/api/types';
import { ConfirmDialog } from '@/ui';
import { useDeleteSchedule } from '../hooks/useScheduleQueries';
import { ScheduleFormDialog } from './ScheduleFormDialog';
import styles from './Schedules.module.css';

enum Kind {
  Form = 'form',
  Delete = 'delete',
}

interface State {
  kind: Kind;
  schedule?: Schedule;
  open: boolean;
  seq: number;
}

/** The create, edit and delete dialogs for a page; render `dialogs` once. */
export function useScheduleDialogs(onDeleted?: () => void): {
  openCreate: () => void;
  openEdit: (s: Schedule) => void;
  confirmDelete: (s: Schedule) => void;
  dialogs: ReactNode;
} {
  const [state, setState] = useState<State | null>(null);
  const del = useDeleteSchedule();
  const show = (kind: Kind, schedule?: Schedule) =>
    setState((prev) => ({ kind, schedule, open: true, seq: (prev?.seq ?? 0) + 1 }));
  const onOpenChange = (open: boolean) => {
    if (!open) setState((s) => (s ? { ...s, open: false } : s));
  };

  const dialogs =
    state?.kind === Kind.Form ? (
      <ScheduleFormDialog
        key={state.seq}
        open={state.open}
        onOpenChange={onOpenChange}
        schedule={state.schedule}
      />
    ) : state?.kind === Kind.Delete && state.schedule ? (
      <ConfirmDialog
        open={state.open}
        onOpenChange={onOpenChange}
        title="Delete schedule"
        confirmLabel="Delete schedule"
        onConfirm={async () => {
          await del.mutateAsync(state.schedule!);
          onDeleted?.();
        }}
      >
        <p className={styles.confirmText}>
          <b>{state.schedule.name}</b> stops running. Jobs already created by this schedule will not
          be affected.
        </p>
      </ConfirmDialog>
    ) : null;

  return {
    openCreate: () => show(Kind.Form),
    openEdit: (s) => show(Kind.Form, s),
    confirmDelete: (s) => show(Kind.Delete, s),
    dialogs,
  };
}
