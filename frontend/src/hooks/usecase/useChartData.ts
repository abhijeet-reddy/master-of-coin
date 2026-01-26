import { useMemo } from 'react';
import type { SpendingTrendPoint, CategoryBreakdownItem } from '@/types';

/**
 * Transform data for chart visualization
 * CONSTRAINT: No useState (derived data only)
 *
 * @param data - Raw data to transform
 * @returns Formatted chart data
 */
export default function useChartData(data: {
  spendingTrend?: SpendingTrendPoint[];
  categoryBreakdown?: CategoryBreakdownItem[];
}) {
  const chartData = useMemo(() => {
    const trendData = (data.spendingTrend || []).map((point) => ({
      month: point.month,
      amount: point.amount,
    }));

    const categoryData = (data.categoryBreakdown || []).map((cat) => ({
      name: cat.category_name || 'Uncategorized',
      value: parseFloat(cat.total) || 0,
      percentage: cat.percentage,
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
    }));

    return {
      trendData,
      categoryData,
    };
  }, [data.spendingTrend, data.categoryBreakdown]);

  return chartData;
}
