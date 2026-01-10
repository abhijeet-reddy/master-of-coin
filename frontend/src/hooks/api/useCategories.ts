import { useQuery } from '@tanstack/react-query';
import { getCategories } from '@/services/categoryService';

/**
 * Fetch all categories for the current user
 * Uses React Query for data fetching and caching
 *
 * @returns React Query result with categories data
 */
export default function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });
}
