import { Card, HStack, Text, VStack, Box } from '@chakra-ui/react';
import { formatCurrency } from '@/utils/formatters';
import { useDebtCalculator, useDebtSummary, useTransactions } from '@/hooks';
import type { Person } from '@/types';

interface DebtSummaryProps {
  people: Person[];
}

export const DebtSummary = ({ people }: DebtSummaryProps) => {
  const { data: transactionsResponse } = useTransactions();
  // Flatten all pages of transactions into a single array
  const transactions = transactionsResponse?.pages.flatMap((page) => page.data) ?? [];
  const { totalOwedToMe, totalIOwe, netBalance } = useDebtCalculator(people, transactions);
  const { netAmount, peopleWithDebts, netStatus } = useDebtSummary(people, netBalance);

  const NetIcon = netStatus.icon;

  return (
    <Card.Root mb={6}>
      <Card.Body>
        <VStack align="stretch" gap={4}>
          <Text fontSize="lg" fontWeight="semibold">
            Debt Overview
          </Text>

          <HStack gap={6} flexWrap="wrap">
            {/* Total Owed to Me */}
            <VStack align="start" flex="1" minW="150px">
              <Text fontSize="sm" color="fg.muted">
                Owed to Me
              </Text>
              <Text fontSize="2xl" fontWeight="bold" color="green.600">
                {formatCurrency(parseFloat(totalOwedToMe))}
              </Text>
            </VStack>

            {/* Total I Owe */}
            <VStack align="start" flex="1" minW="150px">
              <Text fontSize="sm" color="fg.muted">
                I Owe
              </Text>
              <Text fontSize="2xl" fontWeight="bold" color="red.600">
                {formatCurrency(parseFloat(totalIOwe))}
              </Text>
            </VStack>

            {/* Net Amount */}
            <VStack align="start" flex="1" minW="150px">
              <Text fontSize="sm" color="fg.muted">
                Net Amount
              </Text>
              <HStack>
                <Text fontSize="2xl" fontWeight="bold" color={netStatus.color}>
                  {formatCurrency(Math.abs(netAmount))}
                </Text>
                <Box color={netStatus.color} fontSize="xl">
                  <NetIcon />
                </Box>
              </HStack>
              <Text fontSize="xs" color={netStatus.color}>
                {netStatus.text}
              </Text>
            </VStack>

            {/* People with Outstanding Debts */}
            <VStack align="start" flex="1" minW="150px">
              <Text fontSize="sm" color="fg.muted">
                Outstanding Debts
              </Text>
              <Text fontSize="2xl" fontWeight="bold">
                {peopleWithDebts}
              </Text>
              <Text fontSize="xs" color="fg.muted">
                {peopleWithDebts === 1 ? 'person' : 'people'}
              </Text>
            </VStack>
          </HStack>
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};
