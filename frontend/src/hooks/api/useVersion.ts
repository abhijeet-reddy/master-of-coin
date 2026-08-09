import { useQuery } from '@tanstack/react-query';
import { getVersion } from '@/services/versionService';

/**
 * Fetch the deployed build's version (issue #83) from the authenticated
 * /api/v1/version endpoint.
 *
 * Pass `enabled` from the caller's auth state so it does not fire (and 401) on
 * the login screen or after the session expires. Cached indefinitely, since the
 * version only changes on a redeploy which reloads the page. The caller hides
 * the version line entirely when there is no data rather than rendering a
 * broken value.
 *
 * @param enabled - whether there is an authenticated session
 * @returns React Query result of the version payload
 */
export default function useVersion(enabled: boolean) {
  return useQuery({
    queryKey: ['version'],
    queryFn: getVersion,
    enabled,
    staleTime: Infinity,
    retry: 1,
  });
}
