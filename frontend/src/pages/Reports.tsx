import { useState } from 'react';
import { Box, Button, HStack, VStack, Tabs } from '@chakra-ui/react';
import { useDocumentTitle } from '@/hooks/effects';
import {
  useDashboardSummary,
  useEnrichedTransactions,
  useEnrichedBudgetStatuses,
  useAccounts,
} from '@/hooks/api';
import { PageHeader, LoadingSpinner, ErrorAlert } from '@/components/common';
import { MonthlyReport, CategoryReport, BudgetReport, NetWorthReport } from '@/components/reports';

type ReportType = 'monthly' | 'category' | 'budget' | 'networth';

export default function Reports() {
  useDocumentTitle('Reports');
  const [selectedReport, setSelectedReport] = useState<ReportType>('monthly');

  const {
    data: dashboardData,
    isLoading: isDashboardLoading,
    error: dashboardError,
  } = useDashboardSummary();
  const { data: accountsData, isLoading: isAccountsLoading } = useAccounts();

  const enrichedTransactions = useEnrichedTransactions(dashboardData?.recent_transactions);
  const enrichedBudgetStatuses = useEnrichedBudgetStatuses(dashboardData?.budget_statuses);

  const isLoading = isDashboardLoading || isAccountsLoading;

  if (isLoading) {
    return <LoadingSpinner message="Loading reports..." />;
  }

  if (dashboardError) {
    return (
      <Box>
        <PageHeader title="Reports" />
        <ErrorAlert title="Error loading reports" error={dashboardError} />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Reports"
        subtitle="Financial insights and analytics"
        actions={
          <HStack gap={2}>
            <Button variant="outline" size="sm" disabled>
              Export PDF
            </Button>
            <Button variant="outline" size="sm" disabled>
              Export CSV
            </Button>
          </HStack>
        }
      />

      <VStack gap={6} alignItems="stretch">
        {/* Report Type Selector */}
        <Tabs.Root
          value={selectedReport}
          onValueChange={(e) => setSelectedReport(e.value as ReportType)}
          variant="enclosed"
        >
          <Tabs.List>
            <Tabs.Trigger value="monthly">Monthly Report</Tabs.Trigger>
            <Tabs.Trigger value="category">Category Analysis</Tabs.Trigger>
            <Tabs.Trigger value="budget">Budget Performance</Tabs.Trigger>
            <Tabs.Trigger value="networth">Net Worth</Tabs.Trigger>
          </Tabs.List>

          <Box mt={6}>
            <Tabs.Content value="monthly">
              {dashboardData && (
                <MonthlyReport
                  transactions={enrichedTransactions}
                  categoryBreakdown={dashboardData.category_breakdown}
                />
              )}
            </Tabs.Content>

            <Tabs.Content value="category">
              {dashboardData && (
                <CategoryReport categoryBreakdown={dashboardData.category_breakdown} />
              )}
            </Tabs.Content>

            <Tabs.Content value="budget">
              <BudgetReport budgets={enrichedBudgetStatuses} />
            </Tabs.Content>

            <Tabs.Content value="networth">
              {accountsData && <NetWorthReport accounts={accountsData} />}
            </Tabs.Content>
          </Box>
        </Tabs.Root>
      </VStack>
    </Box>
  );
}
