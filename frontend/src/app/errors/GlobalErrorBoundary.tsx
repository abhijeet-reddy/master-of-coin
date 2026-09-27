import type { ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import styles from './GlobalError.module.css';

/**
 * Last line of defence, outside the router and the providers, so it may not
 * use any app context. Plain markup on the design tokens only.
 */
export function GlobalErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary fallback={(error, reset) => <GlobalError error={error} onRetry={reset} />}>
      {children}
    </ErrorBoundary>
  );
}

export function GlobalError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return (
    <div className={styles.wrap} role="alert">
      <p className={styles.code} aria-hidden>
        ERR / APP HALTED
      </p>
      <h1 className={styles.title}>Something went wrong</h1>
      <p className={styles.msg}>{message}</p>
      <div className={styles.row}>
        {onRetry ? (
          <button type="button" className={styles.btn} onClick={onRetry}>
            Try again
          </button>
        ) : null}
        <button
          type="button"
          className={`${styles.btn} ${styles.primary}`}
          onClick={() => window.location.reload()}
        >
          Reload page
        </button>
      </div>
    </div>
  );
}
