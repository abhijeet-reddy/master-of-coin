import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateAccount } from '@/services/accountService';
import type { AccountType } from '@/types';

/**
 * Update an existing account
 * Invalidates accounts and dashboard queries on success
 *
 * @returns React Query mutation for updating accounts
 */
export default function useUpdateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<{
        name: string;
        type: AccountType;
        currency: string;
        notes: string;
      }>;
    }) => updateAccount(id, data),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
      void queryClient.invalidateQueries({ queryKey: ['accounts', variables.id] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
