/** Server aggregates for the report tabs. Keys are shared with the dashboard where they overlap. */
import { useQuery } from '@tanstack/react-query';
import { getMonthlyTotals, getNetWorthHistory, getSpendingTrend } from '@/api/analytics';
import { keys } from '@/api/keys';
import {
  historyInterval,
  monthsInRange,
  monthsToRequest,
  trendWindow,
  type DateRange,
} from '../lib/reportRange';

const MINUTE = 60_000;

/** Monthly income and spend for the months the range touches. */
export function useMonthlyInRange(range: DateRange) {
  const { months, clipped } = monthsToRequest(range, new Date());
  const query = useQuery({
    queryKey: keys.analytics.monthly(months),
    queryFn: () => getMonthlyTotals(months),
    staleTime: 5 * MINUTE,
    select: (series) => monthsInRange(series, range),
  });
  return { query, clipped };
}

/** Spend per day across the range (its last 1000 days when longer). */
export function useDailySpend(range: DateRange) {
  const window = trendWindow(range);
  const params = window.range;
  const query = useQuery({
    queryKey: keys.analytics.spendingTrend(params),
    queryFn: () => getSpendingTrend(params),
    staleTime: 5 * MINUTE,
  });
  return { query, window };
}

/** Net worth over the range: weekly for up to 120 days, monthly beyond. */
export function useNetWorthInRange(range: DateRange) {
  const params = { from: range.from, to: range.to, interval: historyInterval(range) };
  return useQuery({
    queryKey: keys.analytics.netWorth(params),
    queryFn: () => getNetWorthHistory(params),
    staleTime: 5 * MINUTE,
  });
}
