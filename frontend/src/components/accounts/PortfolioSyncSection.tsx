import { Badge, Box, Button, Card, HStack, Spinner, Text, VStack } from '@chakra-ui/react';
import { FaSync, FaRedo, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { usePortfolioSyncTrigger } from '@/hooks/usecase';
import { JobStatus } from '@/types';

interface PortfolioSyncSectionProps {
  accountId: string;
}

/**
 * Portfolio sync trigger and status display for an investment account.
 * Shows sync button, job progress, and results.
 */
export const PortfolioSyncSection = ({ accountId }: PortfolioSyncSectionProps) => {
  const { syncJob, isSyncing, handleSync, handleRetry } = usePortfolioSyncTrigger(accountId);

  const accountResult = syncJob?.result?.synced_accounts?.find((r) => r.account_id === accountId);

  return (
    <Card.Root>
      <Card.Header>
        <HStack justify="space-between">
          <HStack gap={2}>
            <Box as={FaSync} color="blue.500" />
            <Text fontWeight="semibold">Portfolio Sync</Text>
          </HStack>
          <Button
            size="sm"
            colorPalette="blue"
            onClick={handleSync}
            loading={isSyncing}
            disabled={isSyncing}
          >
            <FaSync />
            Sync Now
          </Button>
        </HStack>
      </Card.Header>
      <Card.Body>
        {/* Syncing state */}
        {isSyncing && (
          <HStack gap={3}>
            <Spinner size="sm" />
            <Text fontSize="sm" color="fg.muted">
              Syncing portfolio value from Trading 212...
            </Text>
          </HStack>
        )}

        {/* Completed state */}
        {syncJob?.status === JobStatus.COMPLETED && accountResult && (
          <VStack align="stretch" gap={3}>
            <HStack gap={2}>
              <Box as={FaCheckCircle} color="green.500" />
              <Text fontSize="sm" fontWeight="medium" color="green.600">
                Sync completed
              </Text>
              <Badge colorPalette={accountResult.status === 'synced' ? 'green' : 'gray'} size="sm">
                {accountResult.status === 'synced' ? 'Updated' : 'No Change'}
              </Badge>
            </HStack>

            <HStack gap={6} flexWrap="wrap">
              <VStack align="start" gap={0}>
                <Text fontSize="xs" color="fg.muted">
                  Previous Balance
                </Text>
                <Text fontSize="sm" fontWeight="medium">
                  €{accountResult.previous_balance}
                </Text>
              </VStack>
              <VStack align="start" gap={0}>
                <Text fontSize="xs" color="fg.muted">
                  New Value
                </Text>
                <Text fontSize="sm" fontWeight="medium">
                  €{accountResult.new_value}
                </Text>
              </VStack>
              <VStack align="start" gap={0}>
                <Text fontSize="xs" color="fg.muted">
                  Adjustment
                </Text>
                <Text
                  fontSize="sm"
                  fontWeight="medium"
                  color={
                    parseFloat(accountResult.adjustment_amount) > 0
                      ? 'green.500'
                      : parseFloat(accountResult.adjustment_amount) < 0
                        ? 'red.500'
                        : 'fg.muted'
                  }
                >
                  {parseFloat(accountResult.adjustment_amount) > 0 ? '+' : ''}€
                  {accountResult.adjustment_amount}
                </Text>
              </VStack>
            </HStack>
          </VStack>
        )}

        {/* Failed state */}
        {syncJob?.status === JobStatus.FAILED && (
          <VStack align="stretch" gap={3}>
            <HStack gap={2}>
              <Box as={FaTimesCircle} color="red.500" />
              <Text fontSize="sm" color="red.500">
                Sync failed: {syncJob.error ?? 'Unknown error'}
              </Text>
            </HStack>
            <Button size="sm" variant="outline" colorPalette="red" onClick={handleRetry}>
              <FaRedo />
              Retry
            </Button>
          </VStack>
        )}

        {/* Idle state (no sync job yet) */}
        {!syncJob && !isSyncing && (
          <Text fontSize="sm" color="fg.muted">
            Click &quot;Sync Now&quot; to fetch the latest portfolio value from your brokerage.
          </Text>
        )}
      </Card.Body>
    </Card.Root>
  );
};
