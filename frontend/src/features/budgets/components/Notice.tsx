import type { ReactNode } from 'react';
import { CircleAlert, Info } from 'lucide-react';
import styles from './Budgets.module.css';

/** Inline message in a dialog: an error (role alert) or a note (role status). */
export function Notice({ info = false, children }: { info?: boolean; children: ReactNode }) {
  const Icon = info ? Info : CircleAlert;
  return (
    <p className={`${styles.notice} ${info ? styles.info : ''}`} role={info ? 'status' : 'alert'}>
      <Icon aria-hidden />
      <span>{children}</span>
    </p>
  );
}
