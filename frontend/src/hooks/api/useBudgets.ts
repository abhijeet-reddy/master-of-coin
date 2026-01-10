import { useQuery } from '@tanstack/react-query';
import { getBudgets } from '@/services/budgetService';

/**
 * Fetch all budgets with optional active filter
 * Uses React Query for data fetching and caching
 *
 * @param params - Optional parameters (active filter)
 * @returns React Query result with budgets data
 */
export default function useBudgets(params?: { active?: boolean }) {
  return useQuery({
    queryKey: ['budgets', params],
    queryFn: () => getBudgets(params),
  });
}
