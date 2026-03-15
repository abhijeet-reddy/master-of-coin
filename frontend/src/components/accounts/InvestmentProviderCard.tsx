import {
  Badge,
  Box,
  Button,
  Card,
  HStack,
  Text,
  VStack,
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogBackdrop,
  DialogTitle,
} from '@chakra-ui/react';
import { FaChartLine, FaPlug, FaTrash } from 'react-icons/fa';
import { ConnectProviderForm } from './ConnectProviderForm';
import { useInvestmentProviderConnection } from '@/hooks/usecase';

interface InvestmentProviderCardProps {
  accountId: string;
}

/**
 * Shows investment provider connection status for an account.
 * When not connected: shows a "Connect Brokerage" button that opens a form dialog.
 * When connected: shows provider status with disconnect option.
 */
export const InvestmentProviderCard = ({ accountId }: InvestmentProviderCardProps) => {
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

  if (isLoading) return null;

  return (
    <>
      <Card.Root>
        <Card.Header>
          <HStack justify="space-between">
            <HStack gap={2}>
              <Box as={FaChartLine} color="green.500" />
              <Text fontWeight="semibold">Brokerage Connection</Text>
            </HStack>
            {isConnected && (
              <Badge colorPalette="green" size="sm">
                Connected
              </Badge>
            )}
          </HStack>
        </Card.Header>
        <Card.Body>
          {isConnected && provider ? (
            <HStack justify="space-between">
              <VStack align="start" gap={1}>
                <Text fontSize="sm" fontWeight="medium">
                  Trading 212
                </Text>
                <Text fontSize="xs" color="fg.muted">
                  Connected since {new Date(provider.created_at).toLocaleDateString()}
                </Text>
              </VStack>
              <Button
                size="sm"
                variant="ghost"
                colorPalette="red"
                onClick={handleDisconnect}
                loading={isDisconnecting}
              >
                <FaTrash />
                Disconnect
              </Button>
            </HStack>
          ) : (
            <VStack gap={3}>
              <Text fontSize="sm" color="fg.muted">
                Connect your Trading 212 account to automatically sync your portfolio value.
              </Text>
              <Button size="sm" colorPalette="blue" onClick={() => setFormOpen(true)}>
                <FaPlug />
                Connect Trading 212
              </Button>
            </VStack>
          )}
        </Card.Body>
      </Card.Root>

      {/* Connect Provider Dialog */}
      <DialogRoot open={isFormOpen} onOpenChange={(e) => !e.open && setFormOpen(false)} size="md">
        <DialogBackdrop />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Trading 212</DialogTitle>
          </DialogHeader>
          <DialogBody pb={6}>
            <Text fontSize="sm" color="fg.muted" mb={4}>
              Enter your Trading 212 API Key and Secret. You can generate these from the Trading 212
              app settings.
            </Text>
            <ConnectProviderForm
              onSubmit={handleConnect}
              isLoading={isConnecting}
              onCancel={() => setFormOpen(false)}
            />
          </DialogBody>
        </DialogContent>
      </DialogRoot>
    </>
  );
};
