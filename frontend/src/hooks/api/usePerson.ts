import { useQuery } from '@tanstack/react-query';
import { getPerson } from '@/services/personService';

/**
 * Fetch a single person by ID
 * Uses React Query for data fetching and caching
 *
 * @param id - Person ID
 * @returns React Query result with person data
 */
export default function usePerson(id: string) {
  return useQuery({
    queryKey: ['people', id],
    queryFn: () => getPerson(id),
    enabled: !!id,
  });
}
