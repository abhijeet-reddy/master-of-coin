import { Box, Text } from '@chakra-ui/react';
import { PageHeader } from '@/components/common/PageHeader';

export const DashboardPage = () => {
  return (
    <Box>
      <PageHeader title="Dashboard" subtitle="Overview of your finances" />
      <Box bg="white" p={6} borderRadius="lg" boxShadow="sm">
        <Text>Dashboard content will be implemented in Phase 5</Text>
      </Box>
    </Box>
  );
};
