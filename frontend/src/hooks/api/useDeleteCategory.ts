import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteCategory } from '@/services/categoryService';

/**
 * Delete a category
 * Invalidates categories queries on success
 *
 * @returns React Query mutation for deleting categories
 */
export default function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
      void queryClient.invalidateQueries({ queryKey: ['categories', id] });
    },
  });
}
