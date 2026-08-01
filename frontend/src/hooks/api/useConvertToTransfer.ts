import { useMutation, useQueryClient } from '@tanstack/react-query';
import { convertToTransfer } from '@/services/transferService';
import type { ConvertToTransferRequest } from '@/types';

interface ConvertToTransferVars {
  transactionId: string;
  data: ConvertToTransferRequest;
}

/**
 * Convert an existing transaction into a transfer.
 * Invalidates transactions, accounts, dashboard, and budgets queries on success
 * (a conversion creates a linked leg and shifts account balances).
 *
 * @returns React Query mutation for converting a transaction to a transfer
 */
export default function useConvertToTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ transactionId, data }: ConvertToTransferVars) =>
      convertToTransfer(transactionId, data),
    onSuccess: (_result, { transactionId }) => {
      void queryClient.invalidateQueries({ queryKey: ['transactions'] });
      void queryClient.invalidateQueries({ queryKey: ['transaction', transactionId] });
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
}
