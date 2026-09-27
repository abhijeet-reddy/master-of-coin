import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cx } from './cx';
import { Tone } from './types';
import styles from './Tag.module.css';

export interface BadgeProps {
  children: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  className?: string;
}

/** Short status word. The text carries the meaning; tone only reinforces it. */
export function Badge({ children, tone = Tone.Neutral, icon, className }: BadgeProps) {
  return (
    <span className={cx(styles.badge, styles[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

export interface ChipProps {
  children: ReactNode;
  /** Optional dimmed prefix, e.g. "Account". */
  name?: string;
  onRemove?: () => void;
  /** Accessible name for the remove button. Defaults to "Remove <name> filter". */
  removeLabel?: string;
}

/** Active filter token with a remove button. */
export function Chip({ children, name, onRemove, removeLabel }: ChipProps) {
  return (
    <span className={styles.chip}>
      {name ? <span className={styles.chipKey}>{name}:</span> : null}
      <span>{children}</span>
      {onRemove ? (
        <button
          type="button"
          className={styles.remove}
          onClick={onRemove}
          aria-label={removeLabel ?? `Remove ${name ?? ''} filter`.replace('  ', ' ')}
        >
          <X aria-hidden />
        </button>
      ) : null}
    </span>
  );
}
