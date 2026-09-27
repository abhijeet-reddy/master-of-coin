import { ArrowLeftRight, Copy, Pencil, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Transaction } from '@/api/types';
import { Button, ButtonVariant, IconButton } from '@/ui';
import { useTxDialogs } from '../hooks/txDialogs';
import { useRestore, useSplitSync, type MismatchResult } from '../hooks/useTxMutations';
import { SplitMismatchDialog } from './dialogs/SplitMismatchDialog';
import styles from './Transactions.module.css';

/** Footer actions for the drawer and the detail page. */
export function TxDetailActions({ tx, onDeleted }: { tx: Transaction; onDeleted?: () => void }) {
  const dialogs = useTxDialogs();
  const restore = useRestore();
  const [mismatch, setMismatch] = useState<MismatchResult | null>(null);
  const { sync, resolve } = useSplitSync(setMismatch);

  if (tx.deleted_at) {
    return (
      <div className={styles.actions}>
        <Button
          variant={ButtonVariant.Primary}
          icon={<RotateCcw aria-hidden />}
          onClick={() => void restore([tx.id])}
        >
          Restore
        </Button>
        <span />
      </div>
    );
  }

  return (
    <>
      <div className={styles.actions}>
        <Button
          variant={ButtonVariant.Primary}
          icon={<Pencil aria-hidden />}
          onClick={() => dialogs.openEdit(tx)}
        >
          Edit
        </Button>
        {!tx.transfer_info ? (
          <Button icon={<Copy aria-hidden />} onClick={() => dialogs.openDuplicate(tx)}>
            Duplicate
          </Button>
        ) : null}
        {!tx.transfer_info && !tx.debt_metadata ? (
          <Button icon={<ArrowLeftRight aria-hidden />} onClick={() => dialogs.openConvert(tx)}>
            Convert to transfer
          </Button>
        ) : null}
        {tx.splits?.length ? (
          <IconButton
            label="Sync split"
            title="Sync split"
            icon={<RefreshCw />}
            variant={ButtonVariant.Secondary}
            loading={sync.isPending}
            onClick={() => sync.mutate(tx.id)}
          />
        ) : null}
        <IconButton
          label="Delete transaction"
          icon={<Trash2 />}
          variant={ButtonVariant.Danger}
          onClick={() => dialogs.confirmDelete(tx, onDeleted)}
        />
      </div>
      <SplitMismatchDialog
        result={mismatch}
        onClose={() => {
          setMismatch(null);
          resolve.reset();
        }}
        resolving={resolve.isPending}
        error={resolve.error}
        onResolve={(action) =>
          resolve.mutateAsync({ txId: tx.id, expenseId: mismatch!.external_expense_id, action })
        }
      />
    </>
  );
}
