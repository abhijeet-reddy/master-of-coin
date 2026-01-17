import { Badge, Box, Button, Card, HStack, Icon, Progress, Text, VStack } from '@chakra-ui/react';
import { FiAlertCircle, FiCheckCircle, FiClock, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { differenceInDays } from 'date-fns';
import { formatCurrency } from '@/utils/formatters';
import type { EnrichedBudgetStatus, BudgetStatusType } from '@/types';

interface BudgetCardProps {
  budget: EnrichedBudgetStatus;
  onEdit: () => void;
  onDelete: () => void;
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

export const BudgetCard = ({ budget, onEdit, onDelete }: BudgetCardProps) => {
  const StatusIcon = getStatusIcon(budget.status);
  const statusColor = getStatusColor(budget.status);
  const progressColor = getProgressColor(budget.percentage);
  const isOverBudget = budget.percentage > 100;

  // Calculate days remaining
  const daysRemaining = budget.end_date
    ? differenceInDays(new Date(budget.end_date), new Date())
    : null;

  return (
    <Card.Root
      shadow="sm"
      borderLeft="4px solid"
      borderLeftColor={`${statusColor}.500`}
      _hover={{ shadow: 'md', transform: 'translateY(-2px)' }}
      transition="all 0.2s"
    >
      <Card.Body p={5}>
        <VStack align="stretch" gap={4}>
          {/* Header with name and status */}
          <HStack justify="space-between">
            <VStack align="flex-start" gap={1} flex="1">
              <Text fontSize="lg" fontWeight="semibold" color="gray.700">
                {budget.budget_name}
              </Text>
              <Text fontSize="xs" color="gray.500">
                {budget.period}
              </Text>
            </VStack>
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
          <Box>
            <Progress.Root
              value={Math.min(budget.percentage, 100)}
              max={100}
              size="md"
              colorPalette={progressColor}
            >
              <Progress.Track borderRadius="md">
                <Progress.Range />
              </Progress.Track>
            </Progress.Root>
            <HStack justify="space-between" mt={2}>
              <Text fontSize="sm" color="gray.600">
                {budget.percentage.toFixed(1)}% used
              </Text>
              {isOverBudget && (
                <Text fontSize="sm" color="red.600" fontWeight="semibold">
                  {(budget.percentage - 100).toFixed(1)}% over
                </Text>
              )}
            </HStack>
          </Box>

          {/* Spent vs Limit */}
          <HStack justify="space-between" fontSize="sm">
            <VStack align="flex-start" gap={0}>
              <Text color="gray.500" fontSize="xs">
                Spent
              </Text>
              <Text fontWeight="semibold" color={isOverBudget ? 'red.600' : 'gray.700'}>
                {formatCurrency(parseFloat(budget.current_spending))}
              </Text>
            </VStack>
            <VStack align="flex-end" gap={0}>
              <Text color="gray.500" fontSize="xs">
                Limit
              </Text>
              <Text fontWeight="semibold" color="gray.700">
                {formatCurrency(parseFloat(budget.limit_amount))}
              </Text>
            </VStack>
          </HStack>

          {/* Days remaining */}
          {daysRemaining !== null && (
            <Box pt={2} borderTop="1px solid" borderColor="gray.200">
              <Text fontSize="xs" color="gray.600">
                {daysRemaining > 0
                  ? `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} remaining`
                  : daysRemaining === 0
                    ? 'Ends today'
                    : 'Period ended'}
              </Text>
            </Box>
          )}

          {/* Action buttons */}
          <HStack gap={2} pt={2} borderTop="1px solid" borderColor="gray.200">
            <Button
              size="sm"
              variant="outline"
              colorScheme="blue"
              onClick={onEdit}
              flex="1"
              disabled
              title="Budget editing is temporarily disabled - backend doesn't support updating budget ranges"
              aria-label={`Edit budget ${budget.budget_name}`}
            >
              <Icon mr={1}>
                <FiEdit2 />
              </Icon>
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              colorScheme="red"
              onClick={onDelete}
              flex="1"
              aria-label={`Delete budget ${budget.budget_name}`}
            >
              <Icon mr={1}>
                <FiTrash2 />
              </Icon>
              Delete
            </Button>
          </HStack>
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};
