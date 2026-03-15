import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  connectProvider,
  listProviders,
  disconnectProvider,
} from '@/services/investmentProviderService';
import type { ConnectInvestmentProviderRequest } from '@/types';

/**
 * Fetch all investment providers for the current user
 * @returns React Query result with investment provider list
 */
export function useInvestmentProviders() {
  return useQuery({
    queryKey: ['investment-providers'],
    queryFn: listProviders,
  });
}

/**
 * Connect a brokerage provider to an investment account
 * Invalidates investment-providers list on success
 */
export function useConnectInvestmentProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: ConnectInvestmentProviderRequest) => connectProvider(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['investment-providers'] });
    },
  });
}

/**
 * Disconnect (delete) an investment provider
 * Invalidates investment-providers list on success
 */
export function useDisconnectInvestmentProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => disconnectProvider(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['investment-providers'] });
    },
  });
}
