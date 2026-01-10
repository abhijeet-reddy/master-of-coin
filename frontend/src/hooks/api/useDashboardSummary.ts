import { useQuery } from '@tanstack/react-query';
import { getDashboardSummary } from '@/services/dashboardService';

/**
 * Fetch dashboard summary with all key metrics
 * Uses React Query for data fetching and caching
 *
 * @returns React Query result with dashboard data
 */
export default function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboardSummary,
  });
}
