import { Box, Card, Text } from '@chakra-ui/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { CategoryBreakdownItem } from '@/types/models';
import { formatCurrency } from '../../utils/formatters/currency';

interface CategoryBreakdownProps {
  data: CategoryBreakdownItem[];
}

// Color palette for categories
const COLORS = [
  '#2196f3', // blue
  '#4caf50', // green
  '#ff9800', // orange
  '#f44336', // red
  '#9c27b0', // purple
  '#00bcd4', // cyan
  '#ffeb3b', // yellow
  '#795548', // brown
  '#607d8b', // blue-grey
  '#e91e63', // pink
];

export const CategoryBreakdown = ({ data }: CategoryBreakdownProps) => {
  const chartData = data
    .filter((item) => item.percentage > 0)
    .map((item, index) => ({
      name: item.category_name || 'Uncategorized',
      value: parseFloat(item.total),
      percentage: item.percentage,
      color: COLORS[index % COLORS.length],
    }));

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
    if (active && payload && payload.length > 0) {
      const dataPoint = payload[0];
      return (
        <Box bg="bg" p={3} borderRadius="md" shadow="lg" border="1px solid" borderColor="border">
          <Text fontSize="sm" fontWeight="semibold" color="fg" mb={1}>
            {dataPoint.name}
          </Text>
          <Text fontSize="sm" color="brand.600" fontWeight="bold">
            {formatCurrency(dataPoint.value)}
          </Text>
          <Text fontSize="xs" color="fg.muted">
            {dataPoint.payload.percentage.toFixed(2)}% of total
          </Text>
        </Box>
      );
    }
    return null;
  };

  // Custom label for pie slices with 2 decimal precision
  const renderLabel = (entry: any) => {
    return `${entry.percentage.toFixed(2)}%`;
  };

  if (chartData.length === 0) {
    return (
      <Card.Root>
        <Card.Header>
          <Text fontSize="lg" fontWeight="semibold" color="fg">
            Category Breakdown
          </Text>
        </Card.Header>
        <Card.Body>
          <Box py={8} textAlign="center">
            <Text color="fg.muted">No category data available</Text>
          </Box>
        </Card.Body>
      </Card.Root>
    );
  }

  return (
    <Card.Root>
      <Card.Header>
        <Text fontSize="lg" fontWeight="semibold" color="fg">
          Category Breakdown
        </Text>
        <Text fontSize="sm" color="fg.muted">
          Current month spending by category
        </Text>
      </Card.Header>
      <Card.Body>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderLabel}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={36}
              wrapperStyle={{
                paddingTop: '20px',
                fontSize: '12px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </Card.Body>
    </Card.Root>
  );
};
