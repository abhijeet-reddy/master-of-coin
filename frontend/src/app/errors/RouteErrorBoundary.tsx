import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import { ErrorState } from '@/ui';
import { ErrorBoundary } from './ErrorBoundary';

/** Per-route boundary: the shell stays, the page shows the error with a retry. Resets on navigation. */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { reset: resetQueries } = useQueryErrorResetBoundary();
  return (
    <ErrorBoundary
      resetKey={pathname}
      fallback={(error, reset) => (
        <ErrorState
          title="This page failed to load"
          error={error}
          onRetry={() => {
            resetQueries();
            reset();
          }}
        />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
