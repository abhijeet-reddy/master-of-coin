import { useQuery } from '@tanstack/react-query';
import { getCategory } from '@/services/categoryService';

/**
 * Fetch a single category by ID
 * Uses React Query for data fetching and caching
 *
 * @param id - Category ID
 * @returns React Query result with category data
 */
export default function useCategory(id: string) {
  return useQuery({
    queryKey: ['categories', id],
    queryFn: () => getCategory(id),
    enabled: !!id,
  });
}
