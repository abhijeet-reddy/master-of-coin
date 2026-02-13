import { Card, HStack, VStack, Text, Badge, Button } from '@chakra-ui/react';

/**
 * Placeholder card for SplitPro integration (coming soon).
 * Greyed out with a "Coming Soon" badge.
 */
export const SplitProIntegrationCard = () => {
  return (
    <Card.Root opacity={0.6}>
      <Card.Body>
        <VStack align="stretch" gap={4}>
          {/* Header */}
          <HStack justify="space-between">
            <HStack gap={3}>
              <Text fontSize="2xl" color="gray.400">
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
            <Badge colorPalette="purple">Coming Soon</Badge>
          </HStack>

          <Text fontSize="sm" color="fg.muted">
            SplitPro integration will be available in a future update. Stay tuned!
          </Text>

          <Button variant="outline" disabled>
            Connect SplitPro
          </Button>
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};
