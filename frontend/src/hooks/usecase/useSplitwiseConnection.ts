import { useState } from 'react';
import { useDisconnectProvider } from '@/hooks/api/useSplitIntegrations';
import { getSplitwiseAuthUrl } from '@/services/integrationService';
import { toaster } from '@/components/ui/toaster';
import type { SplitProvider } from '@/types';

/**
 * Manages Splitwise connection lifecycle: connect (OAuth redirect) and disconnect.
 * Extracts all business logic from the SplitwiseIntegrationCard component.
 *
 * @param provider - The current Splitwise provider (if connected)
 * @returns Connection state and action handlers
 */
export default function useSplitwiseConnection(provider?: SplitProvider) {
  const [isDisconnectOpen, setIsDisconnectOpen] = useState(false);

  const disconnectMutation = useDisconnectProvider();
  const isConnected = !!provider?.is_active;

  const handleConnect = async () => {
    try {
      const { auth_url } = await getSplitwiseAuthUrl();
      window.location.href = auth_url;
    } catch {
      toaster.create({
        title: 'Connection Failed',
        description: 'Could not start Splitwise authorization. Please try again.',
        type: 'error',
      });
    }
  };

  const handleDisconnect = () => {
    if (!provider) return;
    disconnectMutation.mutate(provider.id, {
      onSuccess: () => {
        setIsDisconnectOpen(false);
        toaster.create({
          title: 'Splitwise Disconnected',
          description: 'Your Splitwise account has been disconnected.',
          type: 'success',
        });
      },
      onError: () => {
        toaster.create({
          title: 'Disconnect Failed',
          description: 'Could not disconnect Splitwise. Please try again.',
          type: 'error',
        });
      },
    });
  };

  return {
    isConnected,
    isDisconnectOpen,
    isDisconnecting: disconnectMutation.isPending,
    openDisconnectDialog: () => setIsDisconnectOpen(true),
    closeDisconnectDialog: () => setIsDisconnectOpen(false),
    handleConnect,
    handleDisconnect,
  };
}
