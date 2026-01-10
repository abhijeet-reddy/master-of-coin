import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateTransaction } from '@/services/transactionService';
import type { UpdateTransactionRequest } from '@/types';

/**
 * Update an existing transaction
 * Invalidates transactions and accounts queries on success
 *
 * @returns React Query mutation for updating transactions
 */
export default function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTransactionRequest }) =>
      updateTransaction(id, data),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['transactions'] });
      void queryClient.invalidateQueries({ queryKey: ['transactions', variables.id] });
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
