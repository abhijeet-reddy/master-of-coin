import { Trash2, X } from 'lucide-react';
import { useState } from 'react';
import type { BulkSelection } from '@/lib/useBulkSelection';
import { Button, ConfirmDialog, ControlSize } from '@/ui';
import { useBulkDelete } from '../hooks/useTxMutations';
import styles from './Transactions.module.css';

/** Floating bar while rows are selected (selection survives paging). Delete asks first, then offers Undo. */
export function BulkBar({ selection }: { selection: BulkSelection }) {
  const [confirm, setConfirm] = useState(false);
  const del = useBulkDelete();
  const n = selection.count;
  if (!n && !confirm) return null;

  const run = async () => {
    const ids = [...selection.selected];
    const res = await del.mutateAsync(ids);
    const failed = new Set(res.failed.map((f) => f.id));
    selection.remove(ids.filter((id) => !failed.has(id)));
    setConfirm(false);
  };

  return (
    <>
      {n ? (
        <div className={styles.bulkbar} role="region" aria-label="Bulk actions">
          <span aria-live="polite">{n} selected</span>
          <Button size={ControlSize.Sm} icon={<X aria-hidden />} onClick={selection.clear}>
            Clear
          </Button>
          <Button
            size={ControlSize.Sm}
            className={styles.bulkDanger}
            icon={<Trash2 aria-hidden />}
            onClick={() => setConfirm(true)}
          >
            Delete {n}
          </Button>
        </div>
      ) : null}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={n === 1 ? 'Delete 1 transaction' : `Delete ${n} transactions`}
        confirmLabel="Delete"
        onConfirm={run}
      >
        {n === 1 ? 'It moves' : 'They move'} to Trash, including any selected on other pages.
        Transfers lose both legs. You can undo straight after, or restore from Trash later.
      </ConfirmDialog>
    </>
  );
}
