import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addBudgetRange } from '@/services/budgetService';
import type { BudgetPeriod } from '@/types';

/**
 * Add a new range to an existing budget
 * Invalidates budgets and dashboard queries on success
 *
 * @returns React Query mutation for adding budget ranges
 */
export default function useAddBudgetRange() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      budgetId,
      data,
    }: {
      budgetId: string;
      data: {
        limit_amount: string;
        period: BudgetPeriod;
        start_date: string;
        end_date?: string;
      };
    }) => addBudgetRange(budgetId, data),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['budgets'] });
      void queryClient.invalidateQueries({ queryKey: ['budgets', variables.budgetId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
