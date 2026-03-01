import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, HStack, IconButton } from '@chakra-ui/react';
import { FiFilter } from 'react-icons/fi';
import { PageHeader, LoadingSpinner, ErrorAlert, ConfirmDialog } from '@/components/common';
import { BudgetInfoCard } from '@/components/budgets';
import { TransactionList, TransactionFilters } from '@/components/transactions';
import { useBudgetDetail } from '@/hooks/usecase';
import { useDocumentTitle } from '@/hooks';

export const BudgetDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const {
    budget,
    isLoading,
    error,
    filteredTransactions,
    isTransactionsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    filters,
    setFilters,
    showFilters,
    toggleFilters,
    clearFilters,
    accounts,
    categories,
    deleteMutation,
  } = useBudgetDetail(id ?? '');

  useDocumentTitle(budget ? `${budget.name} — Budget` : 'Budget');

  const handleConfirmDelete = () => {
    if (!id) return;
    deleteMutation.mutate(id, {
      onSuccess: () => {
        setShowDeleteDialog(false);
        void navigate('/budgets', { replace: true });
      },
    });
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading budget..." />;
  }

  if (error) {
    return (
      <Box>
        <PageHeader breadcrumbs={[{ label: 'Budgets', href: '/budgets' }, { label: 'Error' }]} />
        <ErrorAlert title="Failed to load budget" error={error} />
      </Box>
    );
  }

  if (!budget) {
    return (
      <Box>
        <PageHeader
          breadcrumbs={[{ label: 'Budgets', href: '/budgets' }, { label: 'Not Found' }]}
        />
        <ErrorAlert
          title="Budget not found"
          error={new Error('The budget you are looking for does not exist.')}
        />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        breadcrumbs={[{ label: 'Budgets', href: '/budgets' }, { label: budget.name }]}
        actions={
          <HStack gap={2}>
            <IconButton
              aria-label="Toggle filters"
              variant={showFilters ? 'solid' : 'outline'}
              onClick={toggleFilters}
            >
              <FiFilter />
            </IconButton>
          </HStack>
        }
      />

      <BudgetInfoCard budget={budget} onDelete={() => setShowDeleteDialog(true)} />

      {deleteMutation.isError && deleteMutation.error && (
        <ErrorAlert title="Failed to delete budget" error={deleteMutation.error} />
      )}

      {showFilters && (
        <TransactionFilters
          accounts={accounts}
          categories={categories}
          filters={filters}
          onFilterChange={setFilters}
          onClear={clearFilters}
        />
      )}

      <TransactionList
        transactions={filteredTransactions}
        isLoading={isTransactionsLoading}
        onLoadMore={() => {
          void fetchNextPage();
        }}
        hasMore={hasNextPage}
        isFetchingMore={isFetchingNextPage}
      />

      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Budget"
        message={`Are you sure you want to delete "${budget.name}"? This action cannot be undone.`}
        confirmText="Delete"
        colorScheme="red"
        isLoading={deleteMutation.isPending}
      />
    </Box>
  );
};
