import { Box, Card, Grid, GridItem, HStack, Progress, Stat, Text, VStack } from '@chakra-ui/react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { formatCurrency } from '@/utils/formatters';
import type { EnrichedBudgetStatus } from '@/types';
import { useMemo } from 'react';

interface BudgetReportProps {
  budgets: EnrichedBudgetStatus[];
}

export const BudgetReport = ({ budgets }: BudgetReportProps) => {
  const summary = useMemo(() => {
    const onTrack = budgets.filter((b) => b.status === 'OK').length;
    const warning = budgets.filter((b) => b.status === 'WARNING').length;
    const exceeded = budgets.filter((b) => b.status === 'EXCEEDED').length;

    const totalLimit = budgets.reduce((sum, b) => sum + parseFloat(b.limit_amount), 0);
    const totalSpent = budgets.reduce((sum, b) => sum + parseFloat(b.current_spending), 0);

    return { onTrack, warning, exceeded, totalLimit, totalSpent };
  }, [budgets]);

  const chartData = useMemo(() => {
    return budgets.map((budget) => ({
      name: budget.budget_name,
      spent: parseFloat(budget.current_spending),
      limit: parseFloat(budget.limit_amount),
      remaining: Math.max(0, parseFloat(budget.limit_amount) - parseFloat(budget.current_spending)),
      status: budget.status,
    }));
  }, [budgets]);

  const getBarColor = (status: string) => {
    switch (status) {
      case 'OK':
        return '#38A169';
      case 'WARNING':
        return '#DD6B20';
      case 'EXCEEDED':
        return '#E53E3E';
      default:
        return '#3182CE';
    }
  };

  return (
    <VStack gap={6} alignItems="stretch">
      {/* Summary Stats */}
      <Grid templateColumns={{ base: '1fr', md: 'repeat(4, 1fr)' }} gap={4}>
        <GridItem>
          <Card.Root>
            <Card.Body>
              <Stat.Root>
                <Stat.Label color="gray.600">Total Budgets</Stat.Label>
                <Stat.ValueText fontSize="2xl" fontWeight="bold">
                  {budgets.length}
                </Stat.ValueText>
              </Stat.Root>
            </Card.Body>
          </Card.Root>
        </GridItem>

        <GridItem>
          <Card.Root>
            <Card.Body>
              <Stat.Root>
                <Stat.Label color="gray.600">On Track</Stat.Label>
                <Stat.ValueText fontSize="2xl" fontWeight="bold" color="green.500">
                  {summary.onTrack}
                </Stat.ValueText>
              </Stat.Root>
            </Card.Body>
          </Card.Root>
        </GridItem>

        <GridItem>
          <Card.Root>
            <Card.Body>
              <Stat.Root>
                <Stat.Label color="gray.600">Warning</Stat.Label>
                <Stat.ValueText fontSize="2xl" fontWeight="bold" color="orange.500">
                  {summary.warning}
                </Stat.ValueText>
              </Stat.Root>
            </Card.Body>
          </Card.Root>
        </GridItem>

        <GridItem>
          <Card.Root>
            <Card.Body>
              <Stat.Root>
                <Stat.Label color="gray.600">Exceeded</Stat.Label>
                <Stat.ValueText fontSize="2xl" fontWeight="bold" color="red.500">
                  {summary.exceeded}
                </Stat.ValueText>
              </Stat.Root>
            </Card.Body>
          </Card.Root>
        </GridItem>
      </Grid>

      {/* Overall Progress */}
      <Card.Root>
        <Card.Header>
          <Card.Title>Overall Budget Performance</Card.Title>
        </Card.Header>
        <Card.Body>
          <VStack gap={4} alignItems="stretch">
            <HStack justifyContent="space-between">
              <Text fontSize="sm" color="gray.600">
                Total Spent
              </Text>
              <Text fontSize="sm" fontWeight="bold">
                {formatCurrency(summary.totalSpent)} / {formatCurrency(summary.totalLimit)}
              </Text>
            </HStack>
            <Progress.Root
              value={(summary.totalSpent / summary.totalLimit) * 100}
              size="lg"
              colorPalette={
                summary.totalSpent > summary.totalLimit
                  ? 'red'
                  : summary.totalSpent > summary.totalLimit * 0.8
                    ? 'orange'
                    : 'green'
              }
            >
              <Progress.Track>
                <Progress.Range />
              </Progress.Track>
            </Progress.Root>
          </VStack>
        </Card.Body>
      </Card.Root>

      {/* Budget Comparison Chart */}
      <Card.Root>
        <Card.Header>
          <Card.Title>Budget vs Actual Spending</Card.Title>
        </Card.Header>
        <Card.Body>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Bar dataKey="spent" name="Spent">
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.status)} />
                ))}
              </Bar>
              <Bar dataKey="limit" name="Limit" fill="#CBD5E0" />
            </BarChart>
          </ResponsiveContainer>
        </Card.Body>
      </Card.Root>

      {/* Budget Details */}
      <Card.Root>
        <Card.Header>
          <Card.Title>Budget Details</Card.Title>
        </Card.Header>
        <Card.Body>
          <VStack gap={4} alignItems="stretch">
            {budgets.map((budget, index) => (
              <Box key={index} p={4} borderRadius="md" borderWidth="1px" borderColor="gray.200">
                <VStack gap={3} alignItems="stretch">
                  <HStack justifyContent="space-between">
                    <Text fontWeight="bold">{budget.budget_name}</Text>
                    <HStack gap={2}>
                      <Box
                        px={2}
                        py={1}
                        borderRadius="md"
                        bg={
                          budget.status === 'OK'
                            ? 'green.100'
                            : budget.status === 'WARNING'
                              ? 'orange.100'
                              : 'red.100'
                        }
                        color={
                          budget.status === 'OK'
                            ? 'green.800'
                            : budget.status === 'WARNING'
                              ? 'orange.800'
                              : 'red.800'
                        }
                      >
                        <Text fontSize="xs" fontWeight="bold">
                          {budget.status}
                        </Text>
                      </Box>
                    </HStack>
                  </HStack>

                  <HStack justifyContent="space-between">
                    <Text fontSize="sm" color="gray.600">
                      {formatCurrency(parseFloat(budget.current_spending))} /{' '}
                      {formatCurrency(parseFloat(budget.limit_amount))}
                    </Text>
                    <Text fontSize="sm" fontWeight="bold">
                      {budget.percentage.toFixed(1)}%
                    </Text>
                  </HStack>

                  <Progress.Root
                    value={budget.percentage}
                    size="sm"
                    colorPalette={
                      budget.status === 'OK'
                        ? 'green'
                        : budget.status === 'WARNING'
                          ? 'orange'
                          : 'red'
                    }
                  >
                    <Progress.Track>
                      <Progress.Range />
                    </Progress.Track>
                  </Progress.Root>
                </VStack>
              </Box>
            ))}
          </VStack>
        </Card.Body>
      </Card.Root>
    </VStack>
  );
};
