import { Box, Card, Grid, GridItem, HStack, Stat, Text, VStack } from '@chakra-ui/react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency, formatDate } from '@/utils/formatters';
import type { EnrichedTransaction, CategoryBreakdownItem } from '@/types';
import { useMemo } from 'react';

interface MonthlyReportProps {
  transactions: EnrichedTransaction[];
  categoryBreakdown: CategoryBreakdownItem[];
}

export const MonthlyReport = ({ transactions, categoryBreakdown }: MonthlyReportProps) => {
  const colors = ['#3182CE', '#38A169', '#DD6B20', '#E53E3E', '#805AD5', '#D69E2E'];

  const metrics = useMemo(() => {
    const income = transactions
      .filter((t) => parseFloat(t.amount) > 0)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const expenses = transactions
      .filter((t) => parseFloat(t.amount) < 0)
      .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

    const net = income - expenses;

    return { income, expenses, net };
  }, [transactions]);

  const incomeExpensesData = useMemo(
    () => [
      { name: 'Income', amount: metrics.income },
      { name: 'Expenses', amount: metrics.expenses },
    ],
    [metrics]
  );

  const categoryPieData = useMemo(
    () =>
      categoryBreakdown
        .filter((cat) => cat.percentage > 0)
        .map((cat, index) => ({
          name: cat.category_name || 'Uncategorized',
          value: Math.abs(parseFloat(cat.total)),
          color: colors[index % colors.length],
        })),
    [categoryBreakdown, colors]
  );

  const dailyTrend = useMemo(() => {
    const dailyMap = new Map<string, number>();

    transactions.forEach((t) => {
      const day = formatDate(t.date, 'short');
      const amount = Math.abs(parseFloat(t.amount));
      if (parseFloat(t.amount) < 0) {
        dailyMap.set(day, (dailyMap.get(day) || 0) + amount);
      }
    });

    return Array.from(dailyMap.entries())
      .map(([day, amount]) => ({ day, amount }))
      .slice(0, 10);
  }, [transactions]);

  return (
    <VStack gap={6} alignItems="stretch">
      {/* Key Metrics */}
      <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap={4}>
        <GridItem>
          <Card.Root>
            <Card.Body>
              <Stat.Root>
                <Stat.Label color="fg.muted">Total Income</Stat.Label>
                <Stat.ValueText color="green.500" fontSize="2xl" fontWeight="bold">
                  {formatCurrency(metrics.income)}
                </Stat.ValueText>
              </Stat.Root>
            </Card.Body>
          </Card.Root>
        </GridItem>

        <GridItem>
          <Card.Root>
            <Card.Body>
              <Stat.Root>
                <Stat.Label color="fg.muted">Total Expenses</Stat.Label>
                <Stat.ValueText color="red.500" fontSize="2xl" fontWeight="bold">
                  {formatCurrency(metrics.expenses)}
                </Stat.ValueText>
              </Stat.Root>
            </Card.Body>
          </Card.Root>
        </GridItem>

        <GridItem>
          <Card.Root>
            <Card.Body>
              <Stat.Root>
                <Stat.Label color="fg.muted">Net</Stat.Label>
                <Stat.ValueText
                  color={metrics.net >= 0 ? 'green.500' : 'red.500'}
                  fontSize="2xl"
                  fontWeight="bold"
                >
                  {formatCurrency(metrics.net)}
                </Stat.ValueText>
              </Stat.Root>
            </Card.Body>
          </Card.Root>
        </GridItem>
      </Grid>

      {/* Income vs Expenses Chart */}
      <Card.Root>
        <Card.Header>
          <Card.Title>Income vs Expenses</Card.Title>
        </Card.Header>
        <Card.Body>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={incomeExpensesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Bar dataKey="amount" fill="#3182CE" />
            </BarChart>
          </ResponsiveContainer>
        </Card.Body>
      </Card.Root>

      {/* Category Breakdown */}
      <Grid templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }} gap={6}>
        <GridItem>
          <Card.Root>
            <Card.Header>
              <Card.Title>Category Breakdown</Card.Title>
            </Card.Header>
            <Card.Body>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryPieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </Card.Body>
          </Card.Root>
        </GridItem>

        <GridItem>
          <Card.Root>
            <Card.Header>
              <Card.Title>Top Spending Categories</Card.Title>
            </Card.Header>
            <Card.Body>
              <VStack gap={3} alignItems="stretch">
                {categoryBreakdown.slice(0, 5).map((cat, index) => (
                  <HStack key={index} justifyContent="space-between">
                    <HStack>
                      <Box w={3} h={3} borderRadius="full" bg={colors[index % colors.length]} />
                      <Text fontSize="sm">{cat.category_name || 'Uncategorized'}</Text>
                    </HStack>
                    <Text fontSize="sm" fontWeight="bold">
                      {formatCurrency(Math.abs(parseFloat(cat.total)))}
                    </Text>
                  </HStack>
                ))}
              </VStack>
            </Card.Body>
          </Card.Root>
        </GridItem>
      </Grid>

      {/* Spending Trend */}
      {dailyTrend.length > 0 && (
        <Card.Root>
          <Card.Header>
            <Card.Title>Daily Spending Trend</Card.Title>
          </Card.Header>
          <Card.Body>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#3182CE"
                  strokeWidth={2}
                  name="Spending"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card.Body>
        </Card.Root>
      )}
    </VStack>
  );
};
