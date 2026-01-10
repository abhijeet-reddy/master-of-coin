import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPerson } from '@/services/personService';

/**
 * Create a new person
 * Invalidates people queries on success
 *
 * @returns React Query mutation for creating people
 */
export default function useCreatePerson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name: string;
      email?: string;
      phone?: string;
      notes?: string;
    }) => createPerson(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['people'] });
    },
  });
}
