import { useState } from 'react';
import { VStack, HStack, Heading, Text, Skeleton, Button } from '@chakra-ui/react';
import { MdCompareArrows } from 'react-icons/md';
import { useSplitIntegrations } from '@/hooks/api/useSplitIntegrations';
import { ErrorAlert } from '@/components/common';
import { SplitwiseIntegrationCard } from './SplitwiseIntegrationCard';
import { SplitProIntegrationCard } from './SplitProIntegrationCard';
import { DriftDetectionModal } from './DriftDetectionModal';

/**
 * List of all available split provider integrations.
 * Fetches configured providers and renders a card for each supported provider type.
 * Includes a button to trigger drift detection.
 */
export const SplitIntegrationsList = () => {
  const { data: providers = [], isLoading, error } = useSplitIntegrations();
  const [isDriftModalOpen, setIsDriftModalOpen] = useState(false);

  return (
    <VStack gap={6} align="stretch">
      <VStack align="start" gap={1}>
        <HStack justifyContent="space-between" width="100%">
          <Heading size="md">Split Provider Integrations</Heading>
          <Button
            colorPalette="blue"
            variant="outline"
            size="sm"
            onClick={() => setIsDriftModalOpen(true)}
          >
            <MdCompareArrows />
            Run Drift Detection Job
          </Button>
        </HStack>
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

      <DriftDetectionModal isOpen={isDriftModalOpen} onClose={() => setIsDriftModalOpen(false)} />
    </VStack>
  );
};
