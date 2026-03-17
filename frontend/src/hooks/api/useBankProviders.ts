import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listBankProviders,
  getAuthUrl,
  disconnectProvider,
  startSync,
  getSyncJob,
  getBalance,
  listExternalAccounts,
  linkExternalAccount,
} from '@/services/bankProviderService';
import type { BankSyncRequest } from '@/types/bankProvider';

/**
 * Fetch all bank providers for the current user
 * @returns React Query result with bank provider list
 */
export function useBankProviders() {
  return useQuery({
    queryKey: ['bank-providers'],
    queryFn: listBankProviders,
  });
}

/**
 * Get TrueLayer OAuth authorization URL
 * Invalidates bank-providers list on success
 */
export function useGetBankAuthUrl() {
  return useMutation({
    mutationFn: (accountId: string) => getAuthUrl(accountId),
  });
}

/**
 * Disconnect (delete) a bank provider
 * Invalidates bank-providers list on success
 */
export function useDisconnectBankProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => disconnectProvider(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bank-providers'] });
    },
  });
}

/**
 * Start a bank sync job
 */
export function useStartBankSync() {
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request?: BankSyncRequest }) =>
      startSync(id, request),
  });
}

/**
 * Get bank sync job status and results
 * @param jobId - Job ID to poll
 * @param enabled - Whether to enable polling
 */
export function useBankSyncJob(jobId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['bank-sync-job', jobId],
    queryFn: () => getSyncJob(jobId!),
    enabled: enabled && !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Poll every 2 seconds while job is pending/running
      if (status === 'PENDING' || status === 'RUNNING') return 2000;
      return false;
    },
  });
}

/**
 * Fetch current balance from the bank provider
 * @param id - Bank provider ID
 * @param enabled - Whether to enable the query
 */
export function useBankBalance(id: string | null, enabled = true) {
  return useQuery({
    queryKey: ['bank-balance', id],
    queryFn: () => getBalance(id!),
    enabled: enabled && !!id,
  });
}

/**
 * List external bank accounts from the provider (for linking)
 * @param id - Bank provider ID
 * @param enabled - Whether to enable the query
 */
export function useExternalBankAccounts(id: string | null, enabled = true) {
  return useQuery({
    queryKey: ['external-bank-accounts', id],
    queryFn: () => listExternalAccounts(id!),
    enabled: enabled && !!id,
  });
}

/**
 * Link a specific external bank account to a provider
 * Invalidates bank-providers list on success
 */
export function useLinkExternalAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, externalAccountId }: { id: string; externalAccountId: string }) =>
      linkExternalAccount(id, externalAccountId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bank-providers'] });
      void queryClient.invalidateQueries({ queryKey: ['external-bank-accounts'] });
    },
  });
}
