import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteBudget } from '@/services/budgetService';

/**
 * Delete a budget
 * Invalidates budgets and dashboard queries on success
 *
 * @returns React Query mutation for deleting budgets
 */
export default function useDeleteBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteBudget(id),
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: ['budgets'] });
      void queryClient.invalidateQueries({ queryKey: ['budgets', id] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
