import { Box, Text } from '@chakra-ui/react';
import { PageHeader } from '@/components/common/PageHeader';

interface PlaceholderPageProps {
  title: string;
  subtitle?: string;
  phase?: string;
}

export const PlaceholderPage = ({
  title,
  subtitle,
  phase = 'later phases',
}: PlaceholderPageProps) => {
  return (
    <Box>
      <PageHeader title={title} subtitle={subtitle} />
      <Box bg="white" p={6} borderRadius="lg" boxShadow="sm">
        <Text color="fg.muted">
          {title} page will be implemented in {phase}
        </Text>
      </Box>
    </Box>
  );
};
