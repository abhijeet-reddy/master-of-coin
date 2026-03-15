import { Box, VStack, HStack, Text, Button, Badge, Separator, Skeleton } from '@chakra-ui/react';
import { MdLink, MdDelete } from 'react-icons/md';
import { ConnectProviderForm, PROVIDER_TYPE_LABELS } from './ConnectProviderForm';
import { useInvestmentProviderConnection } from '@/hooks/usecase';

interface BrokerageConnectionConfigProps {
  accountId: string;
}

/**
 * Brokerage connection configuration section for an investment account form.
 * Follows the same pattern as SplitProviderConfig for people.
 * Shows existing connection with disconnect option, or connect form.
 * All business logic is delegated to useInvestmentProviderConnection hook.
 */
export const BrokerageConnectionConfig = ({ accountId }: BrokerageConnectionConfigProps) => {
  const {
    provider,
    isConnected,
    isLoading,
    isConnecting,
    isDisconnecting,
    isFormOpen,
    setFormOpen,
    handleConnect,
    handleDisconnect,
  } = useInvestmentProviderConnection(accountId);

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
        Brokerage Connection
      </Text>

      {/* Show existing connection */}
      {isConnected && provider && (
        <Box p={3} borderWidth="1px" borderRadius="md">
          <HStack justify="space-between">
            <VStack align="start" gap={1}>
              <HStack gap={2}>
                <Badge colorPalette="green" size="sm">
                  {PROVIDER_TYPE_LABELS[provider.provider_type] ?? provider.provider_type}
                </Badge>
                <Text fontSize="sm">
                  Connected since {new Date(provider.created_at).toLocaleDateString()}
                </Text>
              </HStack>
            </VStack>
            <Button
              variant="ghost"
              colorPalette="red"
              size="sm"
              onClick={handleDisconnect}
              loading={isDisconnecting}
              aria-label="Disconnect brokerage"
            >
              <Box as={MdDelete} />
            </Button>
          </HStack>
        </Box>
      )}

      {/* Not connected: show connect button or form */}
      {!isConnected && !isFormOpen && (
        <Button colorPalette="blue" size="sm" variant="outline" onClick={() => setFormOpen(true)}>
          <Box as={MdLink} mr={2} />
          Connect Brokerage
        </Button>
      )}

      {/* Connection form */}
      {!isConnected && isFormOpen && (
        <Box p={3} borderWidth="1px" borderRadius="md">
          <Text fontSize="sm" color="fg.muted" mb={3}>
            Connect your brokerage account to automatically sync your portfolio value.
          </Text>
          <ConnectProviderForm
            onSubmit={handleConnect}
            isLoading={isConnecting}
            onCancel={() => setFormOpen(false)}
          />
        </Box>
      )}
    </VStack>
  );
};
