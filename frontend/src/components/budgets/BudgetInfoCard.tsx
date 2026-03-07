import {
  Badge,
  Box,
  Card,
  HStack,
  Icon,
  IconButton,
  Progress,
  Text,
  VStack,
} from '@chakra-ui/react';
import { FiAlertCircle, FiCheckCircle, FiClock, FiTrash2 } from 'react-icons/fi';
import { differenceInDays } from 'date-fns';
import { formatCurrency } from '@/utils/formatters';
import type { Budget, BudgetStatusType } from '@/types';

interface BudgetInfoCardProps {
  budget: Budget;
  onDelete: () => void;
}

const getStatusFromBudget = (budget: Budget): BudgetStatusType => {
  const percentage = budget.percentage_used ?? 0;
  if (percentage >= 100) return 'EXCEEDED';
  if (percentage >= 80) return 'WARNING';
  return 'OK';
};

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

export const BudgetInfoCard = ({ budget, onDelete }: BudgetInfoCardProps) => {
  const status = getStatusFromBudget(budget);
  const StatusIcon = getStatusIcon(status);
  const statusColor = getStatusColor(status);
  const percentage = budget.percentage_used ?? 0;
  const progressColor = getProgressColor(percentage);
  const isOverBudget = percentage > 100;

  const limitAmount = budget.active_range ? parseFloat(budget.active_range.limit_amount) : 0;
  const currentSpending = budget.current_spending ? parseFloat(budget.current_spending) : 0;

  const daysRemaining = budget.active_range?.end_date
    ? differenceInDays(new Date(budget.active_range.end_date), new Date())
    : null;

  return (
    <Card.Root
      variant="elevated"
      mb={6}
      borderLeft="4px solid"
      borderLeftColor={`${statusColor}.500`}
    >
      <Card.Body p={6}>
        <VStack align="stretch" gap={4}>
          {/* Header */}
          <HStack justify="space-between" align="flex-start">
            <VStack align="start" gap={1}>
              <Text fontSize="xl" fontWeight="bold">
                {budget.name}
              </Text>
              {budget.active_range && (
                <Text fontSize="sm" color="fg.muted">
                  {budget.active_range.period}
                </Text>
              )}
            </VStack>
            <HStack gap={2}>
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
                {status}
              </Badge>
              <IconButton
                aria-label="Delete budget"
                size="sm"
                variant="ghost"
                colorPalette="red"
                onClick={onDelete}
              >
                <FiTrash2 />
              </IconButton>
            </HStack>
          </HStack>

          {/* Progress bar */}
          <Box>
            <Progress.Root
              value={Math.min(percentage, 100)}
              max={100}
              size="md"
              colorPalette={progressColor}
            >
              <Progress.Track borderRadius="md">
                <Progress.Range />
              </Progress.Track>
            </Progress.Root>
            <HStack justify="space-between" mt={2}>
              <Text fontSize="sm" color="fg.muted">
                {percentage.toFixed(1)}% used
              </Text>
              {isOverBudget && (
                <Text fontSize="sm" color="red.600" fontWeight="semibold">
                  {(percentage - 100).toFixed(1)}% over
                </Text>
              )}
            </HStack>
          </Box>

          {/* Spent vs Limit */}
          <HStack justify="space-between" fontSize="sm">
            <VStack align="flex-start" gap={0}>
              <Text color="fg.muted" fontSize="xs">
                Spent
              </Text>
              <Text fontWeight="semibold" fontSize="lg" color={isOverBudget ? 'red.600' : 'fg'}>
                {formatCurrency(currentSpending)}
              </Text>
            </VStack>
            <VStack align="flex-end" gap={0}>
              <Text color="fg.muted" fontSize="xs">
                Limit
              </Text>
              <Text fontWeight="semibold" fontSize="lg" color="fg">
                {formatCurrency(limitAmount)}
              </Text>
            </VStack>
          </HStack>

          {/* Days remaining */}
          {daysRemaining !== null && (
            <Text fontSize="sm" color="fg.muted">
              {daysRemaining > 0
                ? `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} remaining`
                : daysRemaining === 0
                  ? 'Ends today'
                  : 'Period ended'}
            </Text>
          )}
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};
