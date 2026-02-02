import { Box, Card, HStack, VStack, Text, Icon, Badge, Progress } from '@chakra-ui/react';
import { FiAlertCircle, FiCheckCircle, FiClock } from 'react-icons/fi';
import type { EnrichedBudgetStatus, BudgetStatusType } from '@/types/models';
import { EmptyState } from '@/components/common';
import { formatCurrency } from '../../utils/formatters/currency';

interface BudgetProgressProps {
  budgets: EnrichedBudgetStatus[];
}

const getStatusColor = (status: BudgetStatusType): string => {
  switch (status) {
    case 'OK':
      return 'green';
    case 'WARNING':
      return 'yellow';
    case 'EXCEEDED':
      return 'red';
    default:
      return 'gray';
  }
};

const getStatusIcon = (status: BudgetStatusType) => {
  switch (status) {
    case 'OK':
      return FiCheckCircle;
    case 'WARNING':
      return FiClock;
    case 'EXCEEDED':
      return FiAlertCircle;
    default:
      return FiClock;
  }
};

const getProgressColor = (percentage: number): string => {
  if (percentage >= 100) return 'red';
  if (percentage >= 80) return 'yellow';
  return 'green';
};

export const BudgetProgress = ({ budgets }: BudgetProgressProps) => {
  if (budgets.length === 0) {
    return (
      <Box>
        <Text fontSize="lg" fontWeight="semibold" mb={4} color="fg">
          Budget Progress
        </Text>
        <EmptyState
          title="No budgets set"
          description="Create budgets to track your spending goals"
        />
      </Box>
    );
  }

  return (
    <Box>
      <Text fontSize="lg" fontWeight="semibold" mb={4} color="fg">
        Budget Progress
      </Text>
      <HStack
        gap={4}
        overflowX="auto"
        pb={2}
        css={{
          '&::-webkit-scrollbar': {
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#f1f1f1',
            borderRadius: '10px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#888',
            borderRadius: '10px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: '#555',
          },
        }}
      >
        {budgets.map((budget) => {
          const StatusIcon = getStatusIcon(budget.status);
          const statusColor = getStatusColor(budget.status);
          const progressColor = getProgressColor(budget.percentage);
          const isOverBudget = budget.percentage > 100;

          return (
            <Card.Root
              key={budget.budget_id}
              minW="320px"
              shadow="sm"
              borderLeft="4px solid"
              borderLeftColor={`${statusColor}.500`}
              _hover={{ shadow: 'md', transform: 'translateY(-2px)' }}
              transition="all 0.2s"
              cursor="pointer"
            >
              <Card.Body p={4}>
                <VStack alignItems="flex-start" gap={3}>
                  {/* Header with status */}
                  <HStack justifyContent="space-between" width="100%">
                    <Text
                      fontSize="md"
                      fontWeight="semibold"
                      color="fg"
                      css={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      flex="1"
                      title={budget.budget_name}
                    >
                      {budget.budget_name}
                    </Text>
                    <Badge
                      colorPalette={statusColor}
                      fontSize="xs"
                      px={2}
                      py={1}
                      borderRadius="full"
                      display="flex"
                      alignItems="center"
                      gap={1}
                    >
                      <Icon fontSize="xs">
                        <StatusIcon />
                      </Icon>
                      {budget.status}
                    </Badge>
                  </HStack>

                  {/* Progress bar */}
                  <Box width="100%">
                    <Progress.Root
                      value={Math.min(budget.percentage, 100)}
                      max={100}
                      size="sm"
                      colorPalette={progressColor}
                    >
                      <Progress.Track>
                        <Progress.Range />
                      </Progress.Track>
                    </Progress.Root>
                  </Box>

                  {/* Spent vs Limit */}
                  <HStack justifyContent="space-between" width="100%" fontSize="sm">
                    <VStack alignItems="flex-start" gap={0}>
                      <Text color="fg.muted" fontSize="xs">
                        Spent
                      </Text>
                      <Text fontWeight="semibold" color={isOverBudget ? 'red.600' : 'gray.700'}>
                        {formatCurrency(parseFloat(budget.current_spending))}
                      </Text>
                    </VStack>
                    <VStack alignItems="flex-end" gap={0}>
                      <Text color="fg.muted" fontSize="xs">
                        Limit
                      </Text>
                      <Text fontWeight="semibold" color="fg">
                        {formatCurrency(parseFloat(budget.limit_amount))}
                      </Text>
                    </VStack>
                  </HStack>

                  {/* Percentage */}
                  <Box width="100%">
                    <Text
                      fontSize="lg"
                      fontWeight="bold"
                      color={isOverBudget ? 'red.600' : 'gray.700'}
                      textAlign="center"
                    >
                      {budget.percentage.toFixed(1)}% {isOverBudget && 'Over Budget'}
                    </Text>
                  </Box>
                </VStack>
              </Card.Body>
            </Card.Root>
          );
        })}
      </HStack>
    </Box>
  );
};
