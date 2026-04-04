import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteTransaction } from '@/services/transactionService';
import { toaster } from '@/components/ui/toaster';

/**
 * Soft-delete a transaction (moves to trash).
 * Invalidates transactions, trash, dashboard, and budget queries on success.
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
      void queryClient.invalidateQueries({ queryKey: ['transactions', 'trash'] });
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['budgets'] });

      toaster.create({
        title: 'Transaction moved to trash',
        description: 'It will be permanently deleted after 30 days.',
        type: 'success',
      });
    },
  });
}
