import type { Transaction } from '@/api/types';
import { ConfirmDialog } from '@/ui';
import { useDeleteTransaction } from '../../hooks/useTxMutations';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tx: Transaction;
  onDeleted?: () => void;
}

/** Stays open while deleting and shows a failure inline; the toast offers Undo. */
export function DeleteTransactionDialog({ open, onOpenChange, tx, onDeleted }: Props) {
  const del = useDeleteTransaction();
  const transfer = !!tx.transfer_info;
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete transaction"
      confirmLabel="Delete"
      onConfirm={async () => {
        await del.mutateAsync({ id: tx.id, title: tx.title });
        onDeleted?.();
      }}
    >
      <p>
        <strong>{tx.title}</strong> moves to Trash. You can restore it from there
        {transfer ? '. Both legs of the transfer are deleted together.' : '.'}
      </p>
    </ConfirmDialog>
  );
}
