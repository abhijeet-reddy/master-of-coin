import { Badge, Card, HStack, IconButton, Text, VStack } from '@chakra-ui/react';
import { FaKey, FaEdit, FaBan } from 'react-icons/fa';
import type { ApiKey } from '@/models/apiKey';
import { getStatusColor, formatStatus, getScopesSummary } from '@/utils/apiKeyUtils';
import { formatDateWithYear } from '@/utils/formatters';

interface ApiKeyCardProps {
  apiKey: ApiKey;
  onEdit: () => void;
  onRevoke: () => void;
}

export const ApiKeyCard = ({ apiKey, onEdit, onRevoke }: ApiKeyCardProps) => {
  const statusColor = getStatusColor(apiKey.status);
  const isActive = apiKey.status === 'active';

  return (
    <Card.Root>
      <Card.Body>
        <VStack align="stretch" gap={3}>
          {/* Header with icon and actions */}
          <HStack justify="space-between">
            <HStack gap={3}>
              <Text fontSize="2xl" color="blue.500">
                <FaKey />
              </Text>
              <VStack align="start" gap={0}>
                <Text fontSize="lg" fontWeight="semibold">
                  {apiKey.name}
                </Text>
                <Badge colorScheme={statusColor} size="sm">
                  {formatStatus(apiKey.status)}
                </Badge>
              </VStack>
            </HStack>
            <HStack gap={1}>
              {isActive && (
                <>
                  <IconButton aria-label="Edit API key" size="sm" variant="ghost" onClick={onEdit}>
                    <FaEdit />
                  </IconButton>
                  <IconButton
                    aria-label="Revoke API key"
                    size="sm"
                    variant="ghost"
                    colorScheme="red"
                    onClick={onRevoke}
                  >
                    <FaBan />
                  </IconButton>
                </>
              )}
            </HStack>
          </HStack>

          {/* Key Prefix */}
          <VStack align="start" gap={0}>
            <Text fontSize="sm" color="fg.muted">
              Key Prefix
            </Text>
            <Text fontSize="md" fontFamily="mono" fontWeight="medium">
              {apiKey.key_prefix}...
            </Text>
          </VStack>

          {/* Scopes Summary */}
          <VStack align="start" gap={0}>
            <Text fontSize="sm" color="fg.muted">
              Permissions
            </Text>
            <Text fontSize="sm">{getScopesSummary(apiKey)}</Text>
          </VStack>

          {/* Expiration */}
          <HStack justify="space-between">
            <VStack align="start" gap={0}>
              <Text fontSize="sm" color="fg.muted">
                Expires
              </Text>
              <Text fontSize="sm">{formatDateWithYear(apiKey.expires_at)}</Text>
            </VStack>
            <VStack align="start" gap={0}>
              <Text fontSize="sm" color="fg.muted">
                Last Used
              </Text>
              <Text fontSize="sm">{formatDateWithYear(apiKey.last_used_at)}</Text>
            </VStack>
          </HStack>
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};
