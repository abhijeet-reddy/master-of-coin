import { useState } from 'react';
import { Box, Card, HStack, VStack, Text, Button, Badge, Input } from '@chakra-ui/react';
import { MdLink, MdLinkOff } from 'react-icons/md';
import { ConfirmDialog } from '@/components/common';
import { Field } from '@/components/ui/field';
import useSplitProConnection from '@/hooks/usecase/useSplitProConnection';
import type { SplitProvider } from '@/types';

interface SplitProIntegrationCardProps {
  provider?: SplitProvider;
}

/**
 * Card showing SplitPro integration status with connect/disconnect actions.
 * Connect flow only requires the user's SplitPro email — the backend reads
 * SPLITPRO_BASE_URL and SPLITPRO_DATABASE_URL from environment config.
 */
export const SplitProIntegrationCard = ({ provider }: SplitProIntegrationCardProps) => {
  const {
    isConnected,
    isConnecting,
    isFormOpen,
    isDisconnectOpen,
    isDisconnecting,
    openForm,
    closeForm,
    openDisconnectDialog,
    closeDisconnectDialog,
    handleConnect,
    handleDisconnect,
  } = useSplitProConnection(provider);

  const [email, setEmail] = useState('');

  const onSubmit = () => {
    if (!email) return;
    void handleConnect(email);
  };

  return (
    <>
      <Card.Root>
        <Card.Body>
          <VStack align="stretch" gap={4}>
            {/* Header */}
            <HStack justify="space-between">
              <HStack gap={3}>
                <Text fontSize="2xl" color="purple.500">
                  🔀
                </Text>
                <VStack align="start" gap={0}>
                  <Text fontSize="lg" fontWeight="semibold">
                    SplitPro
                  </Text>
                  <Text fontSize="sm" color="fg.muted">
                    Open-source expense splitting
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
                  Disconnect SplitPro
                </Button>
              </VStack>
            )}

            {/* Not connected: show connect button or form */}
            {!isConnected && !isFormOpen && (
              <Button colorPalette="purple" onClick={openForm}>
                <Box as={MdLink} mr={2} />
                Connect SplitPro
              </Button>
            )}

            {/* Connection form */}
            {!isConnected && isFormOpen && (
              <VStack align="stretch" gap={4}>
                <Text fontSize="sm" color="fg.muted">
                  Enter the email address you use to sign in to SplitPro.
                </Text>

                <Field label="Your SplitPro Email">
                  <Input
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                  />
                </Field>

                <HStack gap={2}>
                  <Button
                    colorPalette="purple"
                    onClick={onSubmit}
                    loading={isConnecting}
                    disabled={!email}
                  >
                    <Box as={MdLink} mr={2} />
                    Connect
                  </Button>
                  <Button variant="ghost" onClick={closeForm} disabled={isConnecting}>
                    Cancel
                  </Button>
                </HStack>
              </VStack>
            )}
          </VStack>
        </Card.Body>
      </Card.Root>

      {/* Disconnect confirmation dialog */}
      <ConfirmDialog
        isOpen={isDisconnectOpen}
        onClose={closeDisconnectDialog}
        onConfirm={handleDisconnect}
        title="Disconnect SplitPro"
        message="Are you sure you want to disconnect SplitPro? All person-to-SplitPro mappings and sync records will be deleted. This cannot be undone."
        confirmText="Disconnect"
        colorScheme="red"
        isLoading={isDisconnecting}
      />
    </>
  );
};
