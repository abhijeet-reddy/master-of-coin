import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, HStack, IconButton, useDisclosure } from '@chakra-ui/react';
import { FiFilter } from 'react-icons/fi';
import { PageHeader, LoadingSpinner, ErrorAlert, ConfirmDialog } from '@/components/common';
import { PersonInfoCard, PersonFormModal, SettleDebtModal } from '@/components/people';
import {
  TransactionList,
  TransactionFilters,
  TransactionFormModal,
} from '@/components/transactions';
import { usePersonDetail } from '@/hooks/usecase';
import {
  useDocumentTitle,
  useAccounts,
  useCategories,
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

export const PersonDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSettleOpen, setIsSettleOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const {
    person,
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
  } = usePersonDetail(id ?? '');

  // Data & mutations for duplicate modal
  const { data: accountsData } = useAccounts();
  const { data: categoriesData } = useCategories();
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

  useDocumentTitle(person ? `${person.name} — Person` : 'Person');

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
        void navigate('/people', { replace: true });
      },
    });
  };

  // Loading state
  if (isLoading) {
    return <LoadingSpinner message="Loading person..." />;
  }

  // Error state
  if (error) {
    return (
      <Box>
        <PageHeader breadcrumbs={[{ label: 'People', href: '/people' }, { label: 'Error' }]} />
        <ErrorAlert title="Failed to load person" error={error} />
      </Box>
    );
  }

  // Not found state
  if (!person) {
    return (
      <Box>
        <PageHeader breadcrumbs={[{ label: 'People', href: '/people' }, { label: 'Not Found' }]} />
        <ErrorAlert
          title="Person not found"
          error={new Error('The person you are looking for does not exist.')}
        />
      </Box>
    );
  }

  const debtAmount = person.debt_summary ? parseFloat(person.debt_summary.net) : 0;

  return (
    <Box>
      <PageHeader
        breadcrumbs={[{ label: 'People', href: '/people' }, { label: person.name }]}
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

      {/* Person Info Card */}
      <PersonInfoCard
        person={person}
        onEdit={() => setIsEditOpen(true)}
        onDelete={() => setShowDeleteDialog(true)}
        onSettle={() => setIsSettleOpen(true)}
      />

      {/* Delete Error Alert */}
      {deleteMutation.isError && deleteMutation.error && (
        <ErrorAlert title="Failed to delete person" error={deleteMutation.error} />
      )}

      {/* Transaction Filters */}
      {showFilters && (
        <TransactionFilters
          accounts={accounts}
          categories={categories}
          filters={filters}
          onFilterChange={setFilters}
          onClear={clearFilters}
        />
      )}

      {/* Transaction List */}
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
          from: { type: NavigationSourceType.PERSON, id: person.id, name: person.name },
        }}
      />

      {/* Duplicate Transaction Modal */}
      <TransactionFormModal
        isOpen={isDuplicateOpen}
        onClose={handleDuplicateClose}
        accounts={accountsData || []}
        categories={categoriesData || []}
        people={peopleData || []}
        defaultValues={
          duplicateTransaction ? buildDuplicateDefaults(duplicateTransaction) : undefined
        }
        onSubmit={handleDuplicateSubmit}
        onSubmitDebt={handleDuplicateDebtSubmit}
      />

      {/* Edit Person Modal */}
      <PersonFormModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        person={person}
        onSuccess={() => setIsEditOpen(false)}
      />

      {/* Settle Debt Modal */}
      {debtAmount !== 0 && (
        <SettleDebtModal
          isOpen={isSettleOpen}
          onClose={() => setIsSettleOpen(false)}
          person={person}
          debtAmount={debtAmount}
          onSuccess={() => setIsSettleOpen(false)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Person"
        message={`Are you sure you want to delete "${person.name}"? This action cannot be undone.`}
        confirmText="Delete"
        colorScheme="red"
        isLoading={deleteMutation.isPending}
      />
    </Box>
  );
};
