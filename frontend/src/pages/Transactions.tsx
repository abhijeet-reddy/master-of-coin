import { Box, Text } from '@chakra-ui/react';
import { PageHeader } from '@/components/common/PageHeader';

export const TransactionsPage = () => {
  return (
    <Box>
      <PageHeader title="Transactions" subtitle="Manage your transactions" />
      <Box bg="white" p={6} borderRadius="lg" boxShadow="sm">
        <Text>Transactions page will be implemented in Phase 6</Text>
      </Box>
    </Box>
  );
};
