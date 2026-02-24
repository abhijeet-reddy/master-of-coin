import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createTransfer } from '@/services/transferService';
import type { CreateTransferRequest } from '@/types';

/**
 * Create a transfer between two accounts
 * Invalidates transactions, accounts, and dashboard queries on success
 *
 * @returns React Query mutation for creating transfers
 */
export default function useCreateTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTransferRequest) => createTransfer(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['transactions'] });
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
