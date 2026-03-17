import { Box, VStack, HStack, Text, Button, Badge, Separator, Skeleton } from '@chakra-ui/react';
import { MdLink, MdDelete, MdAccountBalance } from 'react-icons/md';
import { useBankProviderConnection } from '@/hooks/usecase';
import { BankAccountSelector } from './BankAccountSelector';
import { BankBalanceDisplay } from './BankBalanceDisplay';

interface BankConnectionConfigProps {
  accountId: string;
}

/**
 * Bank connection configuration section for an account detail page.
 * Shows existing bank connection with disconnect/sync options, or connect button.
 * All business logic is delegated to useBankProviderConnection hook.
 */
export const BankConnectionConfig = ({ accountId }: BankConnectionConfigProps) => {
  const {
    provider,
    isConnected,
    hasLinkedAccount,
    isLoading,
    isConnecting,
    isDisconnecting,
    balance,
    isLoadingBalance,
    externalAccounts,
    isLoadingAccounts,
    isSelectingAccount,
    setSelectingAccount,
    isLinking,
    handleConnect,
    handleDisconnect,
    handleLinkAccount,
  } = useBankProviderConnection(accountId);

  if (isLoading) {
    return (
      <VStack align="stretch" gap={2}>
        <Separator />
        <Skeleton height="16px" width="160px" />
        <Skeleton height="40px" borderRadius="md" />
      </VStack>
    );
  }

  return (
    <VStack align="stretch" gap={3}>
      <Separator />

      <Text fontWeight="semibold" fontSize="sm">
        Bank Connection
      </Text>

      {/* Connected: show connection info */}
      {isConnected && provider && (
        <Box p={3} borderWidth="1px" borderRadius="md">
          <VStack align="stretch" gap={3}>
            <HStack justify="space-between">
              <VStack align="start" gap={1}>
                <HStack gap={2}>
                  <Badge colorPalette="green" size="sm">
                    {provider.provider_type}
                  </Badge>
                  <Text fontSize="sm">
                    Connected since {new Date(provider.created_at).toLocaleDateString()}
                  </Text>
                </HStack>
                {provider.last_sync_at && (
                  <Text fontSize="xs" color="fg.muted">
                    Last synced: {new Date(provider.last_sync_at).toLocaleString()}
                  </Text>
                )}
              </VStack>
              <Button
                variant="ghost"
                colorPalette="red"
                size="sm"
                onClick={handleDisconnect}
                loading={isDisconnecting}
                aria-label="Disconnect bank"
              >
                <Box as={MdDelete} />
              </Button>
            </HStack>

            {/* Need to link an external account */}
            {!hasLinkedAccount && !isSelectingAccount && (
              <Button
                colorPalette="blue"
                size="sm"
                variant="outline"
                onClick={() => setSelectingAccount(true)}
              >
                <Box as={MdAccountBalance} mr={2} />
                Select Bank Account
              </Button>
            )}

            {/* Account selector */}
            {!hasLinkedAccount && isSelectingAccount && (
              <BankAccountSelector
                accounts={externalAccounts ?? []}
                isLoading={isLoadingAccounts}
                isLinking={isLinking}
                onSelect={handleLinkAccount}
                onCancel={() => setSelectingAccount(false)}
              />
            )}

            {/* Balance display */}
            {hasLinkedAccount && (
              <BankBalanceDisplay balance={balance} isLoading={isLoadingBalance} />
            )}
          </VStack>
        </Box>
      )}

      {/* Not connected: show connect button */}
      {!isConnected && (
        <Button
          colorPalette="blue"
          size="sm"
          variant="outline"
          onClick={handleConnect}
          loading={isConnecting}
        >
          <Box as={MdLink} mr={2} />
          Connect Bank
        </Button>
      )}
    </VStack>
  );
};
