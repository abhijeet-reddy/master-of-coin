import { useMutation, useQueryClient } from '@tanstack/react-query';
import { settleDebt } from '@/services/personService';

/**
 * Settle debt with a person
 * Invalidates people and transactions queries on success
 *
 * @returns React Query mutation for settling debts
 */
export default function useSettleDebt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      personId,
      data,
    }: {
      personId: string;
      data: {
        account_id: string;
        notes?: string;
      };
    }) => settleDebt(personId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['people'] });
      void queryClient.invalidateQueries({ queryKey: ['transactions'] });
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}
