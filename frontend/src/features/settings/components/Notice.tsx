import type { ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import styles from './Settings.module.css';

/** Inline form error. */
export function Notice({ children }: { children: ReactNode }) {
  return (
    <p className={styles.notice} role="alert">
      <CircleAlert aria-hidden />
      <span>{children}</span>
    </p>
  );
}
