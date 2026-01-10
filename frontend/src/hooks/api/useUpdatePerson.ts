import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updatePerson } from '@/services/personService';

/**
 * Update an existing person
 * Invalidates people queries on success
 *
 * @returns React Query mutation for updating people
 */
export default function useUpdatePerson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<{
        name: string;
        email: string;
        phone: string;
        notes: string;
      }>;
    }) => updatePerson(id, data),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['people'] });
      void queryClient.invalidateQueries({ queryKey: ['people', variables.id] });
    },
  });
}
