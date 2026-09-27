import type { ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { Button } from './Button';
import { Dialog } from './Overlay';
import { ButtonVariant } from './types';
import { useConfirmAction } from './useConfirmAction';
import styles from './ConfirmDialog.module.css';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** e.g. "Delete account" */
  title: string;
  /** What will happen, in plain words. */
  children: ReactNode;
  /** May return a promise; the dialog stays open while it runs and shows its error inline. */
  onConfirm: () => unknown;
  confirmLabel?: string;
  /** Destructive styling (default true). */
  destructive?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  children,
  onConfirm,
  confirmLabel = 'Delete',
  destructive = true,
}: ConfirmDialogProps) {
  const action = useConfirmAction(onConfirm, () => onOpenChange(false));

  const handleOpenChange = (next: boolean) => {
    if (action.pending) return;
    if (!next) action.reset();
    onOpenChange(next);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      hazard={destructive}
      footer={
        <>
          <Button onClick={() => handleOpenChange(false)} disabled={action.pending}>
            Cancel
          </Button>
          <Button
            variant={destructive ? ButtonVariant.Danger : ButtonVariant.Primary}
            loading={action.pending}
            onClick={() => void action.run()}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className={styles.body}>{children}</div>
      {action.error ? (
        <p className={styles.error} role="alert">
          <CircleAlert aria-hidden />
          <span>{action.error}</span>
        </p>
      ) : null}
    </Dialog>
  );
}
