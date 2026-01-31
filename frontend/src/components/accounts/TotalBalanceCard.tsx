import { Box, Card, HStack, Text, VStack, Spinner } from '@chakra-ui/react';
import { FaWallet } from 'react-icons/fa';
import { formatCurrency } from '@/utils/formatters';
import { useCurrencyConverter } from '@/hooks/usecase/useCurrencyConverter';
import type { Account } from '@/types';

interface TotalBalanceCardProps {
  accounts: Account[];
}

export const TotalBalanceCard = ({ accounts }: TotalBalanceCardProps) => {
  const { convertToDefault, isLoading } = useCurrencyConverter();

  // Show loading state while exchange rates are being fetched
  if (isLoading) {
    return (
      <Card.Root bg="blue.500" color="white" mb={6}>
        <Card.Body>
          <HStack justify="space-between" align="center">
            <VStack align="start" gap={1}>
              <Text fontSize="sm" opacity={0.9}>
                Total Balance
              </Text>
              <HStack gap={2}>
                <Spinner size="sm" />
                <Text fontSize="lg" opacity={0.8}>
                  Loading exchange rates...
                </Text>
              </HStack>
            </VStack>
            <Box fontSize="4xl" opacity={0.2}>
              <FaWallet />
            </Box>
          </HStack>
        </Card.Body>
      </Card.Root>
    );
  }

  // Calculate total balance across all accounts, converting to default currency
  const totalBalance = accounts.reduce((sum, account) => {
    const convertedBalance = convertToDefault(account.balance, account.currency);
    return sum + convertedBalance;
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
