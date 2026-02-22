import { Card, SimpleGrid, Stat } from '@chakra-ui/react';
import type { DriftSummary } from '@/types';

interface DriftSummaryCardProps {
  summary: DriftSummary;
}

export const DriftSummaryCard = ({ summary }: DriftSummaryCardProps) => {
  return (
    <SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
      <Card.Root variant="elevated">
        <Card.Body p="4">
          <Stat.Root>
            <Stat.Label>Synced</Stat.Label>
            <Stat.ValueText color="green.500">{summary.synced}</Stat.ValueText>
          </Stat.Root>
        </Card.Body>
      </Card.Root>

      <Card.Root variant="elevated">
        <Card.Body p="4">
          <Stat.Root>
            <Stat.Label>Drifted</Stat.Label>
            <Stat.ValueText color="orange.500">{summary.drifted}</Stat.ValueText>
          </Stat.Root>
        </Card.Body>
      </Card.Root>

      <Card.Root variant="elevated">
        <Card.Body p="4">
          <Stat.Root>
            <Stat.Label>Missing on External</Stat.Label>
            <Stat.ValueText color="red.500">{summary.missing_on_external}</Stat.ValueText>
          </Stat.Root>
        </Card.Body>
      </Card.Root>

      <Card.Root variant="elevated">
        <Card.Body p="4">
          <Stat.Root>
            <Stat.Label>Missing on Local</Stat.Label>
            <Stat.ValueText color="blue.500">{summary.missing_on_local}</Stat.ValueText>
          </Stat.Root>
        </Card.Body>
      </Card.Root>
    </SimpleGrid>
  );
};
