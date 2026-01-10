import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCategory } from '@/services/categoryService';

/**
 * Create a new category
 * Invalidates categories queries on success
 *
 * @returns React Query mutation for creating categories
 */
export default function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name: string;
      icon: string;
      color: string;
      parent_category_id?: string;
    }) => createCategory(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}
