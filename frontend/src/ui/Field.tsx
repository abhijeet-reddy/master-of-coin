import { useId, useMemo, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { cx } from './cx';
import { FieldContext } from './fieldContext';
import styles from './Field.module.css';

export interface FieldProps {
  /** Visible label, always above the control. */
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  /** Use a fixed id when a test or form needs one. */
  id?: string;
  className?: string;
  /** Hide the "(optional)" marker where every control is optional (filter panels). */
  plain?: boolean;
}

/** Label above, control, then hint or error. Child controls pick up the ids from context. */
export function Field({
  label,
  children,
  hint,
  error,
  required = false,
  id,
  className,
  plain = false,
}: FieldProps) {
  const auto = useId();
  const controlId = id ?? `f${auto}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-err` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  const ctx = useMemo(
    () => ({ id: controlId, describedBy, invalid: !!error, required }),
    [controlId, describedBy, error, required]
  );

  return (
    <div className={cx(styles.field, className)}>
      <label htmlFor={controlId} className={styles.label}>
        {label}
        {required || plain ? null : <span className={styles.req}>(optional)</span>}
      </label>
      <FieldContext.Provider value={ctx}>{children}</FieldContext.Provider>
      {error ? (
        <p id={errorId} className={styles.error} role="alert">
          <CircleAlert aria-hidden />
          <span>{error}</span>
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
