import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toaster } from '@/components/ui/toaster';

/**
 * Handles OAuth callback status from URL query params.
 * After Splitwise OAuth, the backend redirects to /settings?tab=split&status=connected.
 * This hook reads those params, shows a toast, and cleans the URL.
 *
 * @returns The default tab value to use (from query param or 'profile')
 */
export default function useSplitwiseCallbackStatus() {
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab');
  const statusParam = searchParams.get('status');
  const defaultTab = tabParam || 'profile';

  useEffect(() => {
    if (statusParam === 'connected') {
      toaster.create({
        title: 'Splitwise Connected',
        description: 'Your Splitwise account has been connected successfully!',
        type: 'success',
      });
      // Clean URL params after showing toast
      setSearchParams({}, { replace: true });
    } else if (statusParam === 'error') {
      toaster.create({
        title: 'Connection Failed',
        description: 'Failed to connect Splitwise. Please try again.',
        type: 'error',
      });
      setSearchParams({}, { replace: true });
    }
  }, [statusParam, setSearchParams]);

  return { defaultTab };
}
