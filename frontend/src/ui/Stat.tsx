import type { ReactNode } from 'react';
import styles from './Stat.module.css';

export interface StatProps {
  label: ReactNode;
  /** Usually a <Money>, a count or a percentage. */
  value: ReactNode;
  /** Delta, comparison or a meter. */
  foot?: ReactNode;
}

/** Labelled figure, one cell of a <StatGroup>. */
export function Stat({ label, value, foot }: StatProps) {
  return (
    <div className={styles.stat}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>{value}</dd>
      {foot ? <dd className={styles.foot}>{foot}</dd> : null}
    </div>
  );
}

/** Hairline grid of stats (a description list). */
export function StatGroup({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <dl className={styles.group} aria-label={label}>
      {children}
    </dl>
  );
}
