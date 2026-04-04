import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateAccountBalance } from '@/services/accountService';
import { toaster } from '@/components/ui/toaster';

/**
 * Mutation hook for manually setting an investment account's balance.
 * The server calculates the difference and creates an adjustment transaction if needed.
 *
 * @returns React Query mutation for updating investment account balance
 */
export default function useUpdateAccountBalance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, balance }: { id: string; balance: number }) =>
      updateAccountBalance(id, balance),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
      void queryClient.invalidateQueries({ queryKey: ['accounts', variables.id] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toaster.create({
        title: 'Balance updated',
        description: 'Investment account value has been updated.',
        type: 'success',
      });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to update balance';
      toaster.create({
        title: 'Update failed',
        description: message,
        type: 'error',
      });
    },
  });
}
