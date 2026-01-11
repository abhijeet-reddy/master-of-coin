import { Box, Card, HStack, Text, VStack } from '@chakra-ui/react';
import { FaWallet } from 'react-icons/fa';
import { formatCurrency } from '@/utils/formatters';
import type { Account } from '@/types';

interface TotalBalanceCardProps {
  accounts: Account[];
}

export const TotalBalanceCard = ({ accounts }: TotalBalanceCardProps) => {
  // Calculate total balance across all accounts
  const totalBalance = accounts.reduce((sum, account) => {
    return sum + account.balance;
  }, 0);

  return (
    <Card.Root bg="blue.500" color="white" mb={6}>
      <Card.Body>
        <HStack justify="space-between" align="center">
          <VStack align="start" gap={1}>
            <Text fontSize="sm" opacity={0.9}>
              Total Balance
            </Text>
            <Text fontSize="3xl" fontWeight="bold">
              {formatCurrency(totalBalance)}
            </Text>
            <Text fontSize="sm" opacity={0.8}>
              {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}
            </Text>
          </VStack>
          <Box fontSize="4xl" opacity={0.2}>
            <FaWallet />
          </Box>
        </HStack>
      </Card.Body>
    </Card.Root>
  );
};
