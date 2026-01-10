import { useQuery } from '@tanstack/react-query';
import { getBudget } from '@/services/budgetService';

/**
 * Fetch a single budget by ID
 * Uses React Query for data fetching and caching
 *
 * @param id - Budget ID
 * @returns React Query result with budget data
 */
export default function useBudget(id: string) {
  return useQuery({
    queryKey: ['budgets', id],
    queryFn: () => getBudget(id),
    enabled: !!id,
  });
}
