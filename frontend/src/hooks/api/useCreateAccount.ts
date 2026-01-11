import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createAccount } from '@/services/accountService';
import type { AccountType } from '@/types';

/**
 * Create a new account
 * Invalidates accounts and dashboard queries on success
 *
 * @returns React Query mutation for creating accounts
 */
export default function useCreateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name: string;
      account_type: AccountType;
      currency: string;
      notes?: string;
    }) => createAccount(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
