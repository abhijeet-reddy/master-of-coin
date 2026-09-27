import { lazy, Suspense, type ReactNode } from 'react';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { queryClient } from '@/api/queryClient';
import { getPreferences } from '@/api/preferences';
import { keys } from '@/api/keys';
import { PreferencesProvider } from '@/lib/preferences';
import { Toaster, TooltipProvider } from '@/ui';
import { AuthProvider } from './auth/AuthProvider';
import { useAuth } from './auth/authContext';
import { GlobalErrorBoundary } from './errors/GlobalErrorBoundary';

/** Dev-only; never part of the production bundle. */
const Devtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((m) => ({ default: m.ReactQueryDevtools }))
    )
  : null;

/** Loads the signed-in user's display preferences; defaults apply until then. */
function PreferencesBridge({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { data } = useQuery({
    queryKey: keys.preferences,
    queryFn: getPreferences,
    enabled: isAuthenticated,
    staleTime: Infinity,
  });
  return (
    <PreferencesProvider prefs={isAuthenticated ? data : undefined}>{children}</PreferencesProvider>
  );
}

/** Every app-wide provider, outermost first. The router goes inside. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PreferencesBridge>
            <TooltipProvider>
              {children}
              <Toaster />
            </TooltipProvider>
          </PreferencesBridge>
        </AuthProvider>
        {Devtools ? (
          <Suspense fallback={null}>
            <Devtools initialIsOpen={false} />
          </Suspense>
        ) : null}
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}
