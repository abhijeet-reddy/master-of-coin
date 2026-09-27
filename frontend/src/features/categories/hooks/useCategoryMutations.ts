/**
 * Category writes. A category shows up in the ledger, budgets, the dashboard
 * and analytics, so every write refreshes those too.
 */
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { createCategory, deleteCategory, updateCategory } from '@/api/categories';
import { keys } from '@/api/keys';
import type { Category } from '@/api/types';
import { toast } from '@/ui';
import { buildCategoryRequest, type CategoryFormValues } from '../forms/categoryForm';

function refresh(qc: QueryClient) {
  for (const k of [
    keys.categories.all,
    keys.transactions.all,
    keys.budgets.all,
    keys.dashboard,
    keys.analytics.all,
  ])
    void qc.invalidateQueries({ queryKey: k });
}

export function useSaveCategory(before: Category | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: CategoryFormValues): Promise<Category> =>
      before
        ? updateCategory(before.id, buildCategoryRequest(v, before))
        : createCategory(buildCategoryRequest(v)),
    onSuccess: (saved) => {
      refresh(qc);
      toast.success(before ? 'Category saved' : 'Category created', { description: saved.name });
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (c: Category) => deleteCategory(c.id),
    onSuccess: (_v, c) => {
      refresh(qc);
      toast.success('Category deleted', { description: c.name });
    },
  });
}
