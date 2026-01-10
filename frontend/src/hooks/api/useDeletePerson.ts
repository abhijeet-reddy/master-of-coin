import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deletePerson } from '@/services/personService';

/**
 * Delete a person
 * Invalidates people queries on success
 *
 * @returns React Query mutation for deleting people
 */
export default function useDeletePerson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deletePerson(id),
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: ['people'] });
      void queryClient.invalidateQueries({ queryKey: ['people', id] });
    },
  });
}
