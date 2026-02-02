import { Box, VStack, Text, Grid, GridItem } from '@chakra-ui/react';
import { useDocumentTitle } from '@/hooks/effects';
import {
  useDashboardSummary,
  useEnrichedTransactions,
  useEnrichedBudgetStatuses,
} from '@/hooks/api';
import { PageHeader, LoadingSpinner, ErrorAlert } from '@/components/common';
import {
  NetWorthWidget,
  BudgetProgress,
  CategoryBreakdown,
  RecentTransactions,
} from '@/components/dashboard';

export default function Dashboard() {
  useDocumentTitle('Dashboard');
  const { data, isLoading, error } = useDashboardSummary();

  // Enrich transactions with account and category details using cached data
  const enrichedTransactions = useEnrichedTransactions(data?.recent_transactions);

  // Enrich budget statuses with budget details using cached data
  const enrichedBudgetStatuses = useEnrichedBudgetStatuses(data?.budget_statuses);

  if (isLoading) {
    return <LoadingSpinner message="Loading dashboard..." />;
  }

  if (error) {
    return (
      <Box>
        <PageHeader title="Dashboard" />
        <ErrorAlert title="Error loading dashboard" error={error} />
      </Box>
    );
  }

  if (!data) {
    return (
      <Box>
        <PageHeader title="Dashboard" />
        <Text color="fg.muted">No dashboard data available</Text>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader title="Dashboard" subtitle="Overview of your financial health" />

      <VStack gap={6} alignItems="stretch">
        {/* Row 1: Net Worth Widget (full width) */}
        <NetWorthWidget netWorth={data.net_worth} changePercentage={0} />

        {/* Row 2: Budget Progress (full width) */}
        <BudgetProgress budgets={enrichedBudgetStatuses} />

        {/* Row 3: Grid layout for Category Breakdown and Recent Transactions */}
        <Grid templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }} gap={6}>
          <GridItem>
            <CategoryBreakdown data={data.category_breakdown} />
          </GridItem>
          <GridItem>
            <RecentTransactions transactions={enrichedTransactions} />
          </GridItem>
        </Grid>
      </VStack>
    </Box>
  );
}
