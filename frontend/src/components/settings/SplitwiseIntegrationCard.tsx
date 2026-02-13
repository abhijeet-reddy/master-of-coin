import { Box, Card, HStack, VStack, Text, Button, Badge } from '@chakra-ui/react';
import { MdLink, MdLinkOff } from 'react-icons/md';
import { ConfirmDialog } from '@/components/common';
import { useSplitwiseConnection } from '@/hooks/usecase';
import type { SplitProvider } from '@/types';

interface SplitwiseIntegrationCardProps {
  provider?: SplitProvider;
}

/**
 * Card showing Splitwise integration status with connect/disconnect actions.
 * All business logic is delegated to useSplitwiseConnection hook.
 */
export const SplitwiseIntegrationCard = ({ provider }: SplitwiseIntegrationCardProps) => {
  const {
    isConnected,
    isDisconnectOpen,
    isDisconnecting,
    openDisconnectDialog,
    closeDisconnectDialog,
    handleConnect,
    handleDisconnect,
  } = useSplitwiseConnection(provider);

  return (
    <>
      <Card.Root>
        <Card.Body>
          <VStack align="stretch" gap={4}>
            {/* Header */}
            <HStack justify="space-between">
              <HStack gap={3}>
                <Text fontSize="2xl" color="green.500">
                  💸
                </Text>
                <VStack align="start" gap={0}>
                  <Text fontSize="lg" fontWeight="semibold">
                    Splitwise
                  </Text>
                  <Text fontSize="sm" color="fg.muted">
                    Sync split expenses automatically
                  </Text>
                </VStack>
              </HStack>
              <Badge colorPalette={isConnected ? 'green' : 'gray'}>
                {isConnected ? 'Connected' : 'Not Connected'}
              </Badge>
            </HStack>

            {/* Connected state: show info and disconnect */}
            {isConnected && provider && (
              <VStack align="stretch" gap={3}>
                <HStack justify="space-between">
                  <VStack align="start" gap={0}>
                    <Text fontSize="sm" color="fg.muted">
                      Connected since
                    </Text>
                    <Text fontSize="sm">{new Date(provider.created_at).toLocaleDateString()}</Text>
                  </VStack>
                </HStack>

                <Button
                  variant="outline"
                  colorPalette="red"
                  size="sm"
                  onClick={openDisconnectDialog}
                >
                  <Box as={MdLinkOff} mr={2} />
                  Disconnect Splitwise
                </Button>
              </VStack>
            )}

            {/* Not connected: show connect button */}
            {!isConnected && (
              <Button colorPalette="green" onClick={() => void handleConnect()}>
                <Box as={MdLink} mr={2} />
                Connect Splitwise
              </Button>
            )}
          </VStack>
        </Card.Body>
      </Card.Root>

      {/* Disconnect confirmation dialog */}
      <ConfirmDialog
        isOpen={isDisconnectOpen}
        onClose={closeDisconnectDialog}
        onConfirm={handleDisconnect}
        title="Disconnect Splitwise"
        message="Are you sure you want to disconnect Splitwise? All person-to-Splitwise mappings and sync records will be deleted. This cannot be undone."
        confirmText="Disconnect"
        colorScheme="red"
        isLoading={isDisconnecting}
      />
    </>
  );
};
