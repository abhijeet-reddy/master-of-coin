import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, HStack, IconButton, useDisclosure } from '@chakra-ui/react';
import { FiFilter } from 'react-icons/fi';
import { PageHeader, LoadingSpinner, ErrorAlert, ConfirmDialog } from '@/components/common';
import { BudgetInfoCard } from '@/components/budgets';
import {
  TransactionList,
  TransactionFilterDrawer,
  TransactionFormModal,
} from '@/components/transactions';
import { useBudgetDetail } from '@/hooks/usecase';
import {
  useDocumentTitle,
  useAccounts,
  usePeople,
  useCreateTransaction,
  useCreateDebtTransaction,
} from '@/hooks';
import { NavigationSourceType } from '@/types';
import type {
  EnrichedTransaction,
  CreateTransactionRequest,
  CreateDebtTransactionRequest,
} from '@/types';
import { buildDuplicateDefaults } from '@/utils/transactionDuplicate';

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

  // Data & mutations for duplicate modal
  const { data: accountsData } = useAccounts();
  const { data: peopleData } = usePeople();
  const createMutation = useCreateTransaction();
  const debtMutation = useCreateDebtTransaction();
  const {
    open: isDuplicateOpen,
    onOpen: onDuplicateOpen,
    onClose: onDuplicateClose,
  } = useDisclosure();
  const [duplicateTransaction, setDuplicateTransaction] = useState<EnrichedTransaction | null>(
    null
  );

  useDocumentTitle(budget ? `${budget.name} — Budget` : 'Budget');

  const handleDuplicateTransaction = (transaction: EnrichedTransaction) => {
    setDuplicateTransaction(transaction);
    onDuplicateOpen();
  };

  const handleDuplicateSubmit = async (data: CreateTransactionRequest) => {
    await createMutation.mutateAsync(data);
    setDuplicateTransaction(null);
    onDuplicateClose();
  };

  const handleDuplicateDebtSubmit = async (data: CreateDebtTransactionRequest) => {
    await debtMutation.mutateAsync(data);
    setDuplicateTransaction(null);
    onDuplicateClose();
  };

  const handleDuplicateClose = () => {
    setDuplicateTransaction(null);
    onDuplicateClose();
  };

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

      <TransactionFilterDrawer
        open={showFilters}
        onClose={toggleFilters}
        accounts={accounts}
        categories={categories}
        filters={filters}
        onFilterChange={setFilters}
        onClear={clearFilters}
      />

      <TransactionList
        transactions={filteredTransactions}
        isLoading={isTransactionsLoading}
        onTransactionDuplicate={handleDuplicateTransaction}
        onLoadMore={() => {
          void fetchNextPage();
        }}
        hasMore={hasNextPage}
        isFetchingMore={isFetchingNextPage}
        navigationState={{
          from: { type: NavigationSourceType.BUDGET, id: budget.id, name: budget.name },
        }}
      />

      {/* Duplicate Transaction Modal */}
      <TransactionFormModal
        isOpen={isDuplicateOpen}
        onClose={handleDuplicateClose}
        accounts={accountsData || []}
        categories={categories}
        people={peopleData || []}
        defaultValues={
          duplicateTransaction ? buildDuplicateDefaults(duplicateTransaction) : undefined
        }
        onSubmit={handleDuplicateSubmit}
        onSubmitDebt={handleDuplicateDebtSubmit}
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
