import { QueryClient } from '@tanstack/react-query';

// Create QueryClient with proper defaults
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 5 minutes
      staleTime: 5 * 60 * 1000,
      // Unused data is garbage collected after 10 minutes
      gcTime: 10 * 60 * 1000,
      // Don't refetch on window focus to reduce unnecessary requests
      refetchOnWindowFocus: false,
      // Refetch on reconnect to ensure data is up-to-date
      refetchOnReconnect: true,
      // Retry failed requests once
      retry: 1,
    },
    mutations: {
      // Retry failed mutations once
      retry: 1,
    },
  },
});
