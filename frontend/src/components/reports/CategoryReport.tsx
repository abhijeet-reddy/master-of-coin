import { Box, Card, Grid, GridItem, HStack, Stat, Text, VStack } from '@chakra-ui/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/utils/formatters';
import type { CategoryBreakdownItem } from '@/types';
import { useMemo } from 'react';

interface CategoryReportProps {
  categoryBreakdown: CategoryBreakdownItem[];
}

export const CategoryReport = ({ categoryBreakdown }: CategoryReportProps) => {
  const colors = ['#3182CE', '#38A169', '#DD6B20', '#E53E3E', '#805AD5', '#D69E2E'];

  const topCategories = useMemo(() => {
    return categoryBreakdown.slice(0, 10).map((cat) => ({
      name: cat.category_name || 'Uncategorized',
      amount: Math.abs(parseFloat(cat.total)),
      percentage: cat.percentage,
    }));
  }, [categoryBreakdown]);

  const totalSpending = useMemo(() => {
    return categoryBreakdown.reduce((sum, cat) => sum + Math.abs(parseFloat(cat.total)), 0);
  }, [categoryBreakdown]);

  return (
    <VStack gap={6} alignItems="stretch">
      {/* Summary Stats */}
      <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={4}>
        <GridItem>
          <Card.Root>
            <Card.Body>
              <Stat.Root>
                <Stat.Label color="gray.600">Total Categories</Stat.Label>
                <Stat.ValueText fontSize="2xl" fontWeight="bold">
                  {categoryBreakdown.length}
                </Stat.ValueText>
              </Stat.Root>
            </Card.Body>
          </Card.Root>
        </GridItem>

        <GridItem>
          <Card.Root>
            <Card.Body>
              <Stat.Root>
                <Stat.Label color="gray.600">Total Spending</Stat.Label>
                <Stat.ValueText fontSize="2xl" fontWeight="bold" color="red.500">
                  {formatCurrency(totalSpending)}
                </Stat.ValueText>
              </Stat.Root>
            </Card.Body>
          </Card.Root>
        </GridItem>
      </Grid>

      {/* Top Categories Bar Chart */}
      <Card.Root>
        <Card.Header>
          <Card.Title>Top 10 Spending Categories</Card.Title>
        </Card.Header>
        <Card.Body>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={topCategories} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={150} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Bar dataKey="amount" fill="#3182CE" />
            </BarChart>
          </ResponsiveContainer>
        </Card.Body>
      </Card.Root>

      {/* Category Details List */}
      <Card.Root>
        <Card.Header>
          <Card.Title>Category Breakdown</Card.Title>
        </Card.Header>
        <Card.Body>
          <VStack gap={3} alignItems="stretch">
            {categoryBreakdown.map((cat, index) => (
              <HStack
                key={index}
                justifyContent="space-between"
                p={3}
                borderRadius="md"
                bg="gray.50"
                _hover={{ bg: 'gray.100' }}
              >
                <HStack flex={1}>
                  <Box w={3} h={3} borderRadius="full" bg={colors[index % colors.length]} />
                  <Text fontSize="sm" fontWeight="medium">
                    {cat.category_name || 'Uncategorized'}
                  </Text>
                </HStack>
                <HStack gap={4}>
                  <Text fontSize="sm" color="gray.600">
                    {cat.percentage.toFixed(1)}%
                  </Text>
                  <Text fontSize="sm" fontWeight="bold" minW="100px" textAlign="right">
                    {formatCurrency(Math.abs(parseFloat(cat.total)))}
                  </Text>
                </HStack>
              </HStack>
            ))}
          </VStack>
        </Card.Body>
      </Card.Root>
    </VStack>
  );
};
