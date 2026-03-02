import { useState } from 'react';
import { useDisconnectProvider } from '@/hooks/api/useSplitIntegrations';
import { connectSplitPro } from '@/services/integrationService';
import { toaster } from '@/components/ui/toaster';
import { useQueryClient } from '@tanstack/react-query';
import type { SplitProvider } from '@/types';

/**
 * Manages SplitPro connection lifecycle: connect (form submission) and disconnect.
 * The connect flow only requires a base URL and email - the backend handles
 * session creation automatically via SPLITPRO_DATABASE_URL.
 *
 * @param provider - The current SplitPro provider (if connected)
 * @returns Connection state and action handlers
 */
export default function useSplitProConnection(provider?: SplitProvider) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnectOpen, setIsDisconnectOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const disconnectMutation = useDisconnectProvider();
  const queryClient = useQueryClient();
  const isConnected = !!provider?.is_active;

  const handleConnect = async (email: string) => {
    setIsConnecting(true);
    try {
      await connectSplitPro({ email });
      // Invalidate providers query to refresh the list
      await queryClient.invalidateQueries({ queryKey: ['integrations'] });
      setIsFormOpen(false);
      toaster.create({
        title: 'SplitPro Connected',
        description: 'Your SplitPro instance has been connected successfully.',
        type: 'success',
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not connect to SplitPro. Please check your credentials.';
      toaster.create({
        title: 'Connection Failed',
        description: message,
        type: 'error',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    if (!provider) return;
    disconnectMutation.mutate(provider.id, {
      onSuccess: () => {
        setIsDisconnectOpen(false);
        toaster.create({
          title: 'SplitPro Disconnected',
          description: 'Your SplitPro instance has been disconnected.',
          type: 'success',
        });
      },
      onError: () => {
        toaster.create({
          title: 'Disconnect Failed',
          description: 'Could not disconnect SplitPro. Please try again.',
          type: 'error',
        });
      },
    });
  };

  return {
    isConnected,
    isConnecting,
    isFormOpen,
    isDisconnectOpen,
    isDisconnecting: disconnectMutation.isPending,
    openForm: () => setIsFormOpen(true),
    closeForm: () => setIsFormOpen(false),
    openDisconnectDialog: () => setIsDisconnectOpen(true),
    closeDisconnectDialog: () => setIsDisconnectOpen(false),
    handleConnect,
    handleDisconnect,
  };
}
