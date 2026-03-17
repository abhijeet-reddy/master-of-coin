import { useState } from 'react';
import {
  useBankProviders,
  useGetBankAuthUrl,
  useDisconnectBankProvider,
  useExternalBankAccounts,
  useLinkExternalAccount,
  useBankBalance,
} from '@/hooks/api/useBankProviders';
import { toaster } from '@/components/ui/toaster';

/**
 * Manages bank provider connection lifecycle for a specific account.
 * Handles OAuth flow initiation, disconnect, account linking, and balance display.
 *
 * @param accountId - The Master of Coin account ID
 * @returns Connection state and action handlers
 */
export default function useBankProviderConnection(accountId: string) {
  const [isSelectingAccount, setSelectingAccount] = useState(false);

  const { data: providers, isLoading } = useBankProviders();
  const authUrlMutation = useGetBankAuthUrl();
  const disconnectMutation = useDisconnectBankProvider();
  const linkMutation = useLinkExternalAccount();

  // Find the bank provider for this specific account
  const provider = providers?.find((p) => p.account_id === accountId);
  const isConnected = !!provider?.is_active;
  const hasLinkedAccount = !!provider?.external_account_id;

  // Fetch external accounts when selecting
  const { data: externalAccounts, isLoading: isLoadingAccounts } = useExternalBankAccounts(
    isSelectingAccount && provider ? provider.id : null
  );

  // Fetch balance when connected and linked
  const { data: balance, isLoading: isLoadingBalance } = useBankBalance(
    isConnected && hasLinkedAccount && provider ? provider.id : null
  );

  const handleConnect = () => {
    authUrlMutation.mutate(accountId, {
      onSuccess: (response) => {
        // Redirect to TrueLayer auth dialog
        window.location.href = response.auth_url;
      },
      onError: (error) => {
        const message =
          error instanceof Error
            ? error.message
            : 'Could not initiate bank connection. Please try again.';
        toaster.create({
          title: 'Connection Failed',
          description: message,
          type: 'error',
        });
      },
    });
  };

  const handleDisconnect = () => {
    if (!provider) return;
    disconnectMutation.mutate(provider.id, {
      onSuccess: () => {
        toaster.create({
          title: 'Bank Disconnected',
          description: 'Bank connection has been removed from this account.',
          type: 'success',
        });
      },
      onError: () => {
        toaster.create({
          title: 'Disconnect Failed',
          description: 'Could not disconnect the bank. Please try again.',
          type: 'error',
        });
      },
    });
  };

  const handleLinkAccount = (externalAccountId: string) => {
    if (!provider) return;
    linkMutation.mutate(
      { id: provider.id, externalAccountId },
      {
        onSuccess: () => {
          setSelectingAccount(false);
          toaster.create({
            title: 'Account Linked',
            description: 'Bank account has been linked successfully.',
            type: 'success',
          });
        },
        onError: () => {
          toaster.create({
            title: 'Link Failed',
            description: 'Could not link the bank account. Please try again.',
            type: 'error',
          });
        },
      }
    );
  };

  return {
    provider,
    isConnected,
    hasLinkedAccount,
    isLoading,
    isConnecting: authUrlMutation.isPending,
    isDisconnecting: disconnectMutation.isPending,
    balance,
    isLoadingBalance,
    externalAccounts,
    isLoadingAccounts,
    isSelectingAccount,
    setSelectingAccount,
    isLinking: linkMutation.isPending,
    handleConnect,
    handleDisconnect,
    handleLinkAccount,
  };
}
