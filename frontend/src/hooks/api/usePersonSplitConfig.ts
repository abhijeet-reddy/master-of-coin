import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPersonSplitConfig,
  setPersonSplitConfig,
  deletePersonSplitConfig,
} from '@/services/personService';
import type { SetPersonSplitConfigRequest } from '@/types';

/**
 * Fetch split provider configuration for a person
 * Only fetches when a valid personId is provided
 *
 * @param personId - Person ID to fetch config for
 * @returns React Query result with person split config
 */
export function usePersonSplitConfig(personId: string) {
  return useQuery({
    queryKey: ['people', personId, 'split-config'],
    queryFn: () => getPersonSplitConfig(personId),
    enabled: !!personId,
  });
}

/**
 * Set (create or update) split provider configuration for a person
 * Invalidates person and split config queries on success
 *
 * @returns React Query mutation for setting person split config
 */
export function useSetPersonSplitConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ personId, config }: { personId: string; config: SetPersonSplitConfigRequest }) =>
      setPersonSplitConfig(personId, config),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ['people', variables.personId, 'split-config'],
      });
      void queryClient.invalidateQueries({ queryKey: ['people', variables.personId] });
    },
  });
}

/**
 * Delete split provider configuration for a person
 * Invalidates person and split config queries on success
 *
 * @returns React Query mutation for deleting person split config
 */
export function useDeletePersonSplitConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (personId: string) => deletePersonSplitConfig(personId),
    onSuccess: (_, personId) => {
      void queryClient.invalidateQueries({ queryKey: ['people', personId, 'split-config'] });
      void queryClient.invalidateQueries({ queryKey: ['people', personId] });
    },
  });
}
