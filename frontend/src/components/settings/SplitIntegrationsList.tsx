import { VStack, Heading, Text, Skeleton } from '@chakra-ui/react';
import { useSplitIntegrations } from '@/hooks/api/useSplitIntegrations';
import { ErrorAlert } from '@/components/common';
import { SplitwiseIntegrationCard } from './SplitwiseIntegrationCard';
import { SplitProIntegrationCard } from './SplitProIntegrationCard';

/**
 * List of all available split provider integrations.
 * Fetches configured providers and renders a card for each supported provider type.
 */
export const SplitIntegrationsList = () => {
  const { data: providers = [], isLoading, error } = useSplitIntegrations();

  return (
    <VStack gap={6} align="stretch">
      <VStack align="start" gap={1}>
        <Heading size="md">Split Provider Integrations</Heading>
        <Text fontSize="sm" color="fg.muted">
          Connect your expense splitting services to automatically sync split transactions.
        </Text>
      </VStack>

      {/* Error state */}
      {error && <ErrorAlert error={error} />}

      {/* Loading skeletons */}
      {isLoading && (
        <VStack gap={4} align="stretch">
          <Skeleton height="160px" borderRadius="md" />
          <Skeleton height="160px" borderRadius="md" />
        </VStack>
      )}

      {/* Provider cards */}
      {!isLoading && !error && (
        <>
          <SplitwiseIntegrationCard
            provider={providers.find((p) => p.provider_type === 'splitwise')}
          />
          <SplitProIntegrationCard />
        </>
      )}
    </VStack>
  );
};
