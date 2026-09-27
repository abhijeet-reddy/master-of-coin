import type { Budget, BudgetRange } from '@/api/types';
import { DateStyle } from '@/lib/format';
import { usePreferences } from '@/lib/preferences';
import { ConfirmDialog } from '@/ui';
import { useDeleteBudget, useDeleteRange } from '../hooks/useBudgetMutations';
import styles from './Budgets.module.css';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: Budget;
}

export function DeleteBudgetDialog({
  open,
  onOpenChange,
  budget,
  onDeleted,
}: Props & { onDeleted?: () => void }) {
  const del = useDeleteBudget();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete ${budget.name}?`}
      confirmLabel="Delete budget"
      onConfirm={async () => {
        await del.mutateAsync(budget);
        onDeleted?.();
      }}
    >
      <p className={styles.confirmText}>
        The budget and its range history go for good. Transactions are not touched.
      </p>
    </ConfirmDialog>
  );
}

/** The server refuses to delete a budget's only range; that error shows inline. */
export function DeleteRangeDialog({
  open,
  onOpenChange,
  budget,
  range,
}: Props & { range: BudgetRange }) {
  const { fmt } = usePreferences();
  const del = useDeleteRange(budget);
  const span = `${fmt.date(range.start_date, DateStyle.Medium)} to ${
    range.end_date ? fmt.date(range.end_date, DateStyle.Medium) : 'open ended'
  }`;
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete this range?"
      confirmLabel="Delete range"
      onConfirm={() => del.mutateAsync(range)}
    >
      <p className={styles.confirmText}>
        {span}, {fmt.money(Number(range.limit_amount), budget.currency ?? undefined)} limit.
        Spending in those dates stops counting toward {budget.name}.
      </p>
    </ConfirmDialog>
  );
}
