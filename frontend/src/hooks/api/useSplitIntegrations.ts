import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listProviders, disconnectProvider } from '@/services/integrationService';

/**
 * Fetch list of configured split providers for the current user
 * Uses React Query for data fetching and caching
 *
 * @returns React Query result with providers array
 */
export function useSplitIntegrations() {
  return useQuery({
    queryKey: ['integrations', 'providers'],
    queryFn: listProviders,
  });
}

/**
 * Disconnect (delete) a split provider
 * Invalidates integrations and people queries on success
 * (people queries invalidated because cascade deletes person split configs)
 *
 * @returns React Query mutation for disconnecting providers
 */
export function useDisconnectProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (providerId: string) => disconnectProvider(providerId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['integrations'] });
      void queryClient.invalidateQueries({ queryKey: ['people'] });
    },
  });
}
