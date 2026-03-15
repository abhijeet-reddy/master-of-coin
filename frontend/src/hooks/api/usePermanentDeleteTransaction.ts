import { useMutation, useQueryClient } from '@tanstack/react-query';
import { permanentDeleteTransaction } from '@/services/transactionService';

/**
 * Permanently delete a soft-deleted transaction (cannot be undone)
 * Invalidates trash queries on success
 *
 * @returns React Query mutation for permanently deleting transactions
 */
export default function usePermanentDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => permanentDeleteTransaction(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['transactions', 'trash'] });
    },
  });
}
