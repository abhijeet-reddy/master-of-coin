import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, HStack, IconButton } from '@chakra-ui/react';
import { FiFilter } from 'react-icons/fi';
import { PageHeader, LoadingSpinner, ErrorAlert, ConfirmDialog } from '@/components/common';
import { PersonInfoCard, PersonFormModal, SettleDebtModal } from '@/components/people';
import { TransactionList, TransactionFilters } from '@/components/transactions';
import { usePersonDetail } from '@/hooks/usecase';
import { useDocumentTitle } from '@/hooks';
import { NavigationSourceType } from '@/types';

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

  useDocumentTitle(person ? `${person.name} — Person` : 'Person');

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
        onLoadMore={() => {
          void fetchNextPage();
        }}
        hasMore={hasNextPage}
        isFetchingMore={isFetchingNextPage}
        navigationState={{
          from: { type: NavigationSourceType.PERSON, id: person.id, name: person.name },
        }}
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
