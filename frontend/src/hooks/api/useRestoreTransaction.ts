import { useMutation, useQueryClient } from '@tanstack/react-query';
import { restoreTransaction } from '@/services/transactionService';

/**
 * Restore a soft-deleted transaction
 * Invalidates both transactions and trash queries on success
 *
 * @returns React Query mutation for restoring transactions
 */
export default function useRestoreTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => restoreTransaction(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['transactions'] });
      void queryClient.invalidateQueries({ queryKey: ['transactions', 'trash'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}
