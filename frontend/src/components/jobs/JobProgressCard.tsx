import { Card, Spinner, Text, VStack } from '@chakra-ui/react';
import { JobStatus } from '@/types';

interface JobProgressCardProps {
  status: JobStatus;
}

const statusMessages: Record<string, string> = {
  [JobStatus.PENDING]: 'Job is pending...',
  [JobStatus.RUNNING]: 'Job is running...',
};

export const JobProgressCard = ({ status }: JobProgressCardProps) => {
  const message = statusMessages[status] ?? 'Processing...';

  return (
    <Card.Root variant="elevated">
      <Card.Body>
        <VStack gap={4} py={8}>
          <Spinner size="xl" colorPalette="blue" borderWidth="3px" />
          <Text fontSize="lg" color="fg.muted">
            {message}
          </Text>
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};
