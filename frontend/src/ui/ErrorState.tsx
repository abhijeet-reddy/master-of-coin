import { RotateCw } from 'lucide-react';
import { Button } from './Button';
import { cx } from './cx';
import { ControlSize } from './types';
import styles from './State.module.css';

export interface ErrorStateProps {
  /** Anything thrown; ApiError messages are already user-facing. */
  error: unknown;
  title?: string;
  onRetry?: () => void;
  compact?: boolean;
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return 'Something went wrong.';
}

function statusOf(error: unknown): number | null {
  const s = (error as { status?: unknown } | null)?.status;
  return typeof s === 'number' ? s : null;
}

/** Failure panel with retry. Scope it to the panel that failed, never the whole page. */
export function ErrorState({
  error,
  title = "Couldn't load this",
  onRetry,
  compact = false,
}: ErrorStateProps) {
  const status = statusOf(error);
  return (
    <div className={cx(styles.box, styles.err, compact && styles.compact)} role="alert">
      {status ? <span className={styles.code}>Error {status}</span> : null}
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.desc}>{messageOf(error)}</p>
      {onRetry ? (
        <div className={styles.actions}>
          <Button
            icon={<RotateCw />}
            size={compact ? ControlSize.Sm : ControlSize.Md}
            onClick={onRetry}
          >
            Retry
          </Button>
        </div>
      ) : null}
    </div>
  );
}
