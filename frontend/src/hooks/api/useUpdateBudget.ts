import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateBudget } from '@/services/budgetService';
import type { CreateBudgetRequest } from '@/types';

/**
 * Update an existing budget
 * Invalidates budgets and dashboard queries on success
 *
 * @returns React Query mutation for updating budgets
 */
export default function useUpdateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateBudgetRequest> }) =>
      updateBudget(id, data),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['budgets'] });
      void queryClient.invalidateQueries({ queryKey: ['budgets', variables.id] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
