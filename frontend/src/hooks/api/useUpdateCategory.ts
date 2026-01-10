import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateCategory } from '@/services/categoryService';

/**
 * Update an existing category
 * Invalidates categories queries on success
 *
 * @returns React Query mutation for updating categories
 */
export default function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<{
        name: string;
        icon: string;
        color: string;
        parent_category_id: string;
      }>;
    }) => updateCategory(id, data),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
      void queryClient.invalidateQueries({ queryKey: ['categories', variables.id] });
    },
  });
}
