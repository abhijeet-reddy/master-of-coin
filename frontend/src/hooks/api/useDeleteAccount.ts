import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteAccount } from '@/services/accountService';

/**
 * Delete an account
 * Invalidates accounts and dashboard queries on success
 *
 * @returns React Query mutation for deleting accounts
 */
export default function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteAccount(id),
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
      void queryClient.invalidateQueries({ queryKey: ['accounts', id] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
