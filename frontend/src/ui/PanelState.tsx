import type { ReactNode } from 'react';
import { ErrorState } from './ErrorState';
import type { PanelQuery } from '@/lib/panelQuery';
import styles from './PanelState.module.css';

export interface PanelStateProps<T> {
  query: PanelQuery<T>;
  skeleton: ReactNode;
  /** Return an EmptyState when the data has nothing to show, else null. */
  empty?: (data: T) => ReactNode;
  children: (data: T) => ReactNode;
}

/** Skeleton, error with retry, empty or content: one panel's worth, never the whole page. */
export function PanelState<T>({ query, skeleton, empty, children }: PanelStateProps<T>) {
  if (query.data !== undefined) {
    const e = empty?.(query.data);
    return <>{e ?? children(query.data)}</>;
  }
  if (query.error) return <ErrorState compact error={query.error} onRetry={query.refetch} />;
  return (
    <div className={styles.loading} aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      {skeleton}
    </div>
  );
}
