import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createDebtTransaction } from '@/services/transactionService';
import type { CreateDebtTransactionRequest } from '@/types';

/**
 * Create a "paid by others" (debt) transaction
 * Invalidates transactions, accounts, dashboard, and budgets queries on success
 *
 * @returns React Query mutation for creating debt transactions
 */
export default function useCreateDebtTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateDebtTransactionRequest) => createDebtTransaction(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['transactions'] });
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['budgets'] });
      void queryClient.invalidateQueries({ queryKey: ['people'] });
    },
  });
}
