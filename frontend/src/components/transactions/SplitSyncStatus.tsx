import { Badge, HStack, Spinner, Text, Button, Box, Link } from '@chakra-ui/react';
import { MdCheck, MdError, MdRefresh } from 'react-icons/md';
import { useSplitSyncBadge } from '@/hooks/usecase';

interface SplitSyncStatusProps {
  splitId: string;
}

/**
 * Displays sync status badge for a transaction split.
 * Shows synced/pending/failed state with retry capability.
 * All business logic is delegated to useSplitSyncBadge hook.
 */
export const SplitSyncStatus = ({ splitId }: SplitSyncStatusProps) => {
  const { primarySync, isLoading, isRetrying, handleRetry } = useSplitSyncBadge(splitId);

  if (isLoading) {
    return <Spinner size="xs" />;
  }

  // No sync record means person has no split config
  if (!primarySync) {
    return null;
  }

  const { sync_status, last_error, external_url } = primarySync;

  if (sync_status === 'synced') {
    return (
      <Badge colorPalette="green" size="sm">
        <HStack gap={1}>
          <Box as={MdCheck} />
          {external_url ? (
            <Link
              href={external_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              fontSize="xs"
            >
              Synced
            </Link>
          ) : (
            <Text>Synced</Text>
          )}
        </HStack>
      </Badge>
    );
  }

  if (sync_status === 'pending') {
    return (
      <Badge colorPalette="yellow" size="sm">
        <HStack gap={1}>
          <Spinner size="xs" />
          <Text>Syncing...</Text>
        </HStack>
      </Badge>
    );
  }

  if (sync_status === 'failed') {
    return (
      <HStack gap={1}>
        <Badge colorPalette="red" size="sm" title={last_error || 'Sync failed'}>
          <HStack gap={1}>
            <Box as={MdError} />
            <Text>Failed</Text>
          </HStack>
        </Badge>
        <Button
          size="xs"
          variant="ghost"
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            handleRetry();
          }}
          loading={isRetrying}
          aria-label="Retry sync"
        >
          <Box as={MdRefresh} />
        </Button>
      </HStack>
    );
  }

  return null;
};
