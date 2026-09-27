import type { ReactNode } from 'react';
import { cx } from './cx';
import styles from './State.module.css';

export interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  /** Primary way forward, usually a Button. */
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({ title, description, action, compact = false }: EmptyStateProps) {
  return (
    <div className={cx(styles.box, compact && styles.compact)}>
      <span className={styles.glyph} aria-hidden>
        {'[ 0 ]'}
      </span>
      <h3 className={styles.title}>{title}</h3>
      {description ? <p className={styles.desc}>{description}</p> : null}
      {action ? <div className={styles.actions}>{action}</div> : null}
    </div>
  );
}
