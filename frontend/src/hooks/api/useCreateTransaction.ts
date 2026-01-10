import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createTransaction } from '@/services/transactionService';
import type { CreateTransactionRequest } from '@/types';

/**
 * Create a new transaction
 * Invalidates transactions and accounts queries on success
 *
 * @returns React Query mutation for creating transactions
 */
export default function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTransactionRequest) => createTransaction(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['transactions'] });
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
