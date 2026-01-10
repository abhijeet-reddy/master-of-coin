import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createBudget } from '@/services/budgetService';
import type { CreateBudgetRequest } from '@/types';

/**
 * Create a new budget
 * Invalidates budgets and dashboard queries on success
 *
 * @returns React Query mutation for creating budgets
 */
export default function useCreateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBudgetRequest) => createBudget(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['budgets'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
