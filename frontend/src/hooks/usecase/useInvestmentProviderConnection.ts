import { useState } from 'react';
import {
  useInvestmentProviders,
  useConnectInvestmentProvider,
  useDisconnectInvestmentProvider,
} from '@/hooks/api/useInvestmentProviders';
import { toaster } from '@/components/ui/toaster';
import { InvestmentProviderType } from '@/types';

/**
 * Manages investment provider connection lifecycle for a specific account.
 * Handles connect form, disconnect dialog, and toast notifications.
 *
 * @param accountId - The investment account ID
 * @returns Connection state and action handlers
 */
export default function useInvestmentProviderConnection(accountId: string) {
  const [isFormOpen, setFormOpen] = useState(false);

  const { data: providers, isLoading } = useInvestmentProviders();
  const connectMutation = useConnectInvestmentProvider();
  const disconnectMutation = useDisconnectInvestmentProvider();

  // Find the provider for this specific account
  const provider = providers?.find((p) => p.account_id === accountId);
  const isConnected = !!provider?.is_active;

  const handleConnect = (apiKey: string, apiSecret: string, environment?: string) => {
    connectMutation.mutate(
      {
        account_id: accountId,
        provider_type: InvestmentProviderType.TRADING_212,
        api_key: apiKey,
        api_secret: apiSecret,
        environment,
      },
      {
        onSuccess: () => {
          setFormOpen(false);
          toaster.create({
            title: 'Provider Connected',
            description: 'Trading 212 has been connected to this account.',
            type: 'success',
          });
        },
        onError: (error) => {
          const message =
            error instanceof Error
              ? error.message
              : 'Could not connect to Trading 212. Please check your credentials.';
          toaster.create({
            title: 'Connection Failed',
            description: message,
            type: 'error',
          });
        },
      }
    );
  };

  const handleDisconnect = () => {
    if (!provider) return;
    disconnectMutation.mutate(provider.id, {
      onSuccess: () => {
        toaster.create({
          title: 'Provider Disconnected',
          description: 'Trading 212 has been disconnected from this account.',
          type: 'success',
        });
      },
      onError: () => {
        toaster.create({
          title: 'Disconnect Failed',
          description: 'Could not disconnect the provider. Please try again.',
          type: 'error',
        });
      },
    });
  };

  return {
    provider,
    isConnected,
    isLoading,
    isConnecting: connectMutation.isPending,
    isDisconnecting: disconnectMutation.isPending,
    isFormOpen,
    setFormOpen,
    handleConnect,
    handleDisconnect,
  };
}
