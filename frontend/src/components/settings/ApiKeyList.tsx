import { SimpleGrid, Skeleton } from '@chakra-ui/react';
import { ApiKeyCard } from './ApiKeyCard';
import { EmptyState } from '@/components/common';
import type { ApiKey } from '@/models/apiKey';

interface ApiKeyListProps {
  apiKeys: ApiKey[];
  isLoading?: boolean;
  onEdit: (apiKey: ApiKey) => void;
  onRevoke: (apiKey: ApiKey) => void;
}

export const ApiKeyList = ({ apiKeys, isLoading, onEdit, onRevoke }: ApiKeyListProps) => {
  // Loading skeleton
  if (isLoading) {
    return (
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={6}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} height="200px" borderRadius="md" />
        ))}
      </SimpleGrid>
    );
  }

  // Empty state
  if (apiKeys.length === 0) {
    return (
      <EmptyState
        title="No API keys yet"
        description="Create your first API key to access the API programmatically"
      />
    );
  }

  // API key grid
  return (
    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={6}>
      {apiKeys.map((apiKey) => (
        <ApiKeyCard
          key={apiKey.id}
          apiKey={apiKey}
          onEdit={() => onEdit(apiKey)}
          onRevoke={() => onRevoke(apiKey)}
        />
      ))}
    </SimpleGrid>
  );
};
