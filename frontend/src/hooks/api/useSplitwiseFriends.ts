import { useQuery } from '@tanstack/react-query';
import { getProviderFriends } from '@/services/integrationService';

/**
 * Fetch Splitwise friends for a specific provider
 * Only fetches when a valid providerId is provided
 *
 * @param providerId - Split provider ID to fetch friends from
 * @returns React Query result with friends array
 */
export default function useSplitwiseFriends(providerId: string) {
  return useQuery({
    queryKey: ['integrations', 'friends', providerId],
    queryFn: () => getProviderFriends(providerId),
    enabled: !!providerId,
  });
}
