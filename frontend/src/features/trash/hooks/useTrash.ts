/** The trash list and the one write it adds (delete forever); restore comes from the ledger. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { keys } from '@/api/keys';
import { getTrashTransactions, permanentDeleteTransaction } from '@/api/transactions';
import type { Transaction } from '@/api/types';
import { invalidateAfterWrite } from '@/features/transactions/hooks/useTxMutations';
import { toast } from '@/ui';
import { pageParams } from '../lib/trashModel';

export function useTrash(page: number) {
  const params = pageParams(page);
  return useQuery({
    queryKey: [...keys.transactions.trash, params],
    queryFn: () => getTrashTransactions(params),
    placeholderData: keepPreviousData,
  });
}

export function useDeleteForever() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tx: Pick<Transaction, 'id' | 'title'>) => permanentDeleteTransaction(tx.id),
    onSuccess: (_v, tx) => {
      invalidateAfterWrite(qc);
      toast.success('Deleted forever', { description: tx.title });
    },
  });
}
