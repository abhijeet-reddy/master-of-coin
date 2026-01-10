import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteTransaction } from '@/services/transactionService';

/**
 * Delete a transaction
 * Invalidates transactions and accounts queries on success
 *
 * @returns React Query mutation for deleting transactions
 */
export default function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: ['transactions'] });
      void queryClient.invalidateQueries({ queryKey: ['transactions', id] });
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
