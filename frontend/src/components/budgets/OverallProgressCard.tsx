import { Box, Card, HStack, Progress, Text, VStack } from '@chakra-ui/react';
import { formatCurrency } from '@/utils/formatters';
import type { EnrichedBudgetStatus } from '@/types';

interface OverallProgressCardProps {
  budgets: EnrichedBudgetStatus[];
}

export const OverallProgressCard = ({ budgets }: OverallProgressCardProps) => {
  // Calculate overall statistics
  const totalBudgeted = budgets.reduce((sum, budget) => sum + parseFloat(budget.limit_amount), 0);
  const totalSpent = budgets.reduce((sum, budget) => sum + parseFloat(budget.current_spending), 0);
  const overallPercentage = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;
  const budgetsOverLimit = budgets.filter((b) => b.status === 'EXCEEDED').length;

  // Determine color based on percentage
  const getProgressColor = () => {
    if (overallPercentage >= 100) return 'red';
    if (overallPercentage >= 80) return 'yellow';
    return 'green';
  };

  return (
    <Card.Root mb={6}>
      <Card.Body>
        <VStack align="stretch" gap={4}>
          {/* Header */}
          <HStack justify="space-between">
            <Text fontSize="lg" fontWeight="semibold">
              Overall Budget Progress
            </Text>
            <Text fontSize="sm" color="gray.600">
              {budgets.length} {budgets.length === 1 ? 'Budget' : 'Budgets'}
            </Text>
          </HStack>

          {/* Progress Bar */}
          <Box>
            <HStack justify="space-between" mb={2}>
              <Text fontSize="2xl" fontWeight="bold">
                {formatCurrency(totalSpent)}
              </Text>
              <Text fontSize="sm" color="gray.600">
                of {formatCurrency(totalBudgeted)}
              </Text>
            </HStack>
            <Progress.Root
              value={Math.min(overallPercentage, 100)}
              max={100}
              size="lg"
              colorPalette={getProgressColor()}
            >
              <Progress.Track borderRadius="md">
                <Progress.Range />
              </Progress.Track>
            </Progress.Root>
            <HStack justify="space-between" mt={2}>
              <Text fontSize="sm" color="gray.600">
                {overallPercentage.toFixed(1)}% used
              </Text>
              {budgetsOverLimit > 0 && (
                <Text fontSize="sm" color="red.600" fontWeight="semibold">
                  {budgetsOverLimit} over budget
                </Text>
              )}
            </HStack>
          </Box>

          {/* Summary Stats */}
          <HStack gap={6} pt={2} borderTop="1px solid" borderColor="gray.200">
            <Box>
              <Text fontSize="xs" color="gray.600" mb={1}>
                Remaining
              </Text>
              <Text
                fontSize="md"
                fontWeight="semibold"
                color={totalBudgeted - totalSpent >= 0 ? 'green.600' : 'red.600'}
              >
                {formatCurrency(Math.max(0, totalBudgeted - totalSpent))}
              </Text>
            </Box>
            <Box>
              <Text fontSize="xs" color="gray.600" mb={1}>
                Average Usage
              </Text>
              <Text fontSize="md" fontWeight="semibold">
                {budgets.length > 0 ? (overallPercentage / budgets.length).toFixed(1) : 0}%
              </Text>
            </Box>
          </HStack>
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};
