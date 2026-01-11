import { Card, HStack, Text, VStack } from '@chakra-ui/react';
import { FiArrowDown, FiArrowUp, FiTrendingUp } from 'react-icons/fi';
import { formatCurrency } from '@/utils/formatters';

interface MonthSummaryProps {
  income: number;
  expenses: number;
}

export const MonthSummary = ({ income, expenses }: MonthSummaryProps) => {
  const net = income - expenses;
  const isPositive = net >= 0;

  return (
    <Card.Root mb={6}>
      <Card.Body>
        <HStack gap={4} justify="space-between" flexWrap="wrap">
          {/* Income */}
          <VStack align="start" flex={1} minW="150px">
            <HStack gap={2} color="green.500">
              <FiArrowUp />
              <Text fontSize="sm" fontWeight="medium">
                Income
              </Text>
            </HStack>
            <Text fontSize="2xl" fontWeight="bold" color="green.600">
              {formatCurrency(income)}
            </Text>
          </VStack>

          {/* Expenses */}
          <VStack align="start" flex={1} minW="150px">
            <HStack gap={2} color="red.500">
              <FiArrowDown />
              <Text fontSize="sm" fontWeight="medium">
                Expenses
              </Text>
            </HStack>
            <Text fontSize="2xl" fontWeight="bold" color="red.600">
              {formatCurrency(expenses)}
            </Text>
          </VStack>

          {/* Net */}
          <VStack align="start" flex={1} minW="150px">
            <HStack gap={2} color={isPositive ? 'green.500' : 'red.500'}>
              <FiTrendingUp />
              <Text fontSize="sm" fontWeight="medium">
                Net
              </Text>
            </HStack>
            <Text fontSize="2xl" fontWeight="bold" color={isPositive ? 'green.600' : 'red.600'}>
              {formatCurrency(net)}
            </Text>
          </VStack>
        </HStack>
      </Card.Body>
    </Card.Root>
  );
};
