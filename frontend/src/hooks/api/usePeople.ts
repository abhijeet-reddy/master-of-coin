import { useQuery } from '@tanstack/react-query';
import { getPeople } from '@/services/personService';

/**
 * Fetch all people with debt summaries
 * Uses React Query for data fetching and caching
 *
 * @returns React Query result with people data
 */
export default function usePeople() {
  return useQuery({
    queryKey: ['people'],
    queryFn: getPeople,
  });
}
