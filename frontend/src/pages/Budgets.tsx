import { useState } from 'react';
import { Box, Button } from '@chakra-ui/react';
import { PageHeader, ConfirmDialog } from '@/components/common';
import { OverallProgressCard, BudgetList, BudgetFormModal } from '@/components/budgets';
import { useDocumentTitle } from '@/hooks';
import useBudgets from '@/hooks/api/useBudgets';
import useDeleteBudget from '@/hooks/api/useDeleteBudget';
import useDashboardSummary from '@/hooks/api/useDashboardSummary';
import useEnrichedBudgetStatuses from '@/hooks/api/useEnrichedBudgetStatuses';
import type { EnrichedBudgetStatus } from '@/types';

export const Budgets = () => {
  useDocumentTitle('Budgets');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<EnrichedBudgetStatus | undefined>(undefined);
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    budget: EnrichedBudgetStatus | null;
  }>({
    isOpen: false,
    budget: null,
  });

  const { data: budgets = [], isLoading: budgetsLoading, error: budgetsError } = useBudgets();
  const { data: dashboardData } = useDashboardSummary();
  const deleteMutation = useDeleteBudget();

  // Get enriched budget statuses with spending data
  const enrichedBudgets = useEnrichedBudgetStatuses(dashboardData?.budget_statuses);

  const isLoading = budgetsLoading;
  const error = budgetsError;

  // Error state
  if (error) {
    return (
      <Box>
        <PageHeader title="Budgets" />
        <Box bg="red.50" p={6} borderRadius="lg" border="1px solid" borderColor="red.200">
          <Box color="red.800" fontWeight="semibold" mb={2}>
            Error loading budgets
          </Box>
          <Box color="red.600" fontSize="sm">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </Box>
        </Box>
      </Box>
    );
  }

  // Handle edit - pass enriched budget with limit_amount
  const handleEdit = (enrichedBudget: EnrichedBudgetStatus) => {
    setSelectedBudget(enrichedBudget);
    setIsFormOpen(true);
  };

  // Handle delete
  const handleDelete = (enrichedBudget: EnrichedBudgetStatus) => {
    setDeleteDialog({ isOpen: true, budget: enrichedBudget });
  };

  return (
    <Box>
      <PageHeader
        title="Budgets"
        subtitle="Track and manage your spending goals"
        actions={
          <Button
            colorScheme="blue"
            onClick={() => {
              setSelectedBudget(undefined);
              setIsFormOpen(true);
            }}
          >
            Add Budget
          </Button>
        }
      />

      {/* Overall Progress Card */}
      {!isLoading && enrichedBudgets.length > 0 && (
        <OverallProgressCard budgets={enrichedBudgets} />
      )}

      {/* Budget List */}
      <BudgetList
        budgets={enrichedBudgets}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Budget Form Modal */}
      <BudgetFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedBudget(undefined);
        }}
        budget={selectedBudget}
        onSuccess={() => {
          setIsFormOpen(false);
          setSelectedBudget(undefined);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, budget: null })}
        onConfirm={() => {
          if (deleteDialog.budget) {
            const budget = budgets.find((b) => b.id === deleteDialog.budget!.budget_id);
            if (budget) {
              deleteMutation.mutate(budget.id, {
                onSuccess: () => {
                  setDeleteDialog({ isOpen: false, budget: null });
                },
              });
            }
          }
        }}
        title="Delete Budget"
        message={`Are you sure you want to delete "${budgets.find((b) => b.id === deleteDialog.budget?.budget_id)?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        colorScheme="red"
        isLoading={deleteMutation.isPending}
      />
    </Box>
  );
};
