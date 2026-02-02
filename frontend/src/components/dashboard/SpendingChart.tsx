import { Box, Card, Text } from '@chakra-ui/react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { SpendingTrendPoint } from '@/types/models';
import { formatCurrency } from '../../utils/formatters/currency';

interface SpendingChartProps {
  data: SpendingTrendPoint[];
}

export const SpendingChart = ({ data }: SpendingChartProps) => {
  // Transform data for Recharts
  const chartData = data.map((point) => ({
    month: point.month,
    amount: point.amount,
  }));

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
    if (active && payload && payload.length > 0) {
      const dataPoint = payload[0].payload;
      return (
        <Box bg="bg" p={3} borderRadius="md" shadow="lg" border="1px solid" borderColor="border">
          <Text fontSize="sm" fontWeight="semibold" color="fg" mb={1}>
            {dataPoint.month}
          </Text>
          <Text fontSize="sm" color="brand.600" fontWeight="bold">
            {formatCurrency(dataPoint.amount)}
          </Text>
        </Box>
      );
    }
    return null;
  };

  if (chartData.length === 0) {
    return (
      <Card.Root>
        <Card.Header>
          <Text fontSize="lg" fontWeight="semibold" color="fg">
            Spending Trend
          </Text>
        </Card.Header>
        <Card.Body>
          <Box py={8} textAlign="center">
            <Text color="fg.muted">No spending data available</Text>
          </Box>
        </Card.Body>
      </Card.Root>
    );
  }

  return (
    <Card.Root>
      <Card.Header>
        <Text fontSize="lg" fontWeight="semibold" color="fg">
          Spending Trend
        </Text>
      </Card.Header>
      <Card.Body>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="month"
              tick={{ fill: '#718096', fontSize: 12 }}
              tickLine={{ stroke: '#cbd5e0' }}
            />
            <YAxis
              tick={{ fill: '#718096', fontSize: 12 }}
              tickLine={{ stroke: '#cbd5e0' }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{
                paddingTop: '20px',
                fontSize: '14px',
              }}
            />
            <Line
              type="monotone"
              dataKey="amount"
              name="Spending"
              stroke="#2196f3"
              strokeWidth={3}
              dot={{ fill: '#2196f3', r: 4 }}
              activeDot={{ r: 6, fill: '#1976d2' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card.Body>
    </Card.Root>
  );
};
