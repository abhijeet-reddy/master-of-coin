import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, HStack, IconButton, useDisclosure } from '@chakra-ui/react';
import { FiFilter, FiPlus } from 'react-icons/fi';
import { PageHeader, LoadingSpinner, ErrorAlert, ConfirmDialog } from '@/components/common';
import { AccountInfoCard, AccountFormModal } from '@/components/accounts';
import {
  TransactionList,
  TransactionFilters,
  TransactionFormModal,
} from '@/components/transactions';
import { useAccountDetail } from '@/hooks/usecase';
import {
  useDocumentTitle,
  useAccounts,
  usePeople,
  useCreateTransaction,
  useCreateDebtTransaction,
} from '@/hooks';
import { NavigationSourceType } from '@/types';
import type { CreateTransactionRequest, CreateDebtTransactionRequest } from '@/types';

export const AccountDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const {
    account,
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
    categories,
    deleteMutation,
  } = useAccountDetail(id ?? '');

  // Data for the Add Transaction modal
  const { data: accountsData } = useAccounts();
  const { data: peopleData } = usePeople();
  const { open: isAddTxnOpen, onOpen: onAddTxnOpen, onClose: onAddTxnClose } = useDisclosure();

  const createMutation = useCreateTransaction();
  const debtMutation = useCreateDebtTransaction();

  useDocumentTitle(account ? `${account.name} — Account` : 'Account');

  const handleConfirmDelete = () => {
    if (!id) return;
    deleteMutation.mutate(id, {
      onSuccess: () => {
        setShowDeleteDialog(false);
        void navigate('/accounts', { replace: true });
      },
    });
  };

  const handleCreateSubmit = async (data: CreateTransactionRequest) => {
    await createMutation.mutateAsync(data);
    onAddTxnClose();
  };

  const handleDebtSubmit = async (data: CreateDebtTransactionRequest) => {
    await debtMutation.mutateAsync(data);
    onAddTxnClose();
  };

  // Loading state
  if (isLoading) {
    return <LoadingSpinner message="Loading account..." />;
  }

  // Error state
  if (error) {
    return (
      <Box>
        <PageHeader breadcrumbs={[{ label: 'Accounts', href: '/accounts' }, { label: 'Error' }]} />
        <ErrorAlert title="Failed to load account" error={error} />
      </Box>
    );
  }

  // Not found state
  if (!account) {
    return (
      <Box>
        <PageHeader
          breadcrumbs={[{ label: 'Accounts', href: '/accounts' }, { label: 'Not Found' }]}
        />
        <ErrorAlert
          title="Account not found"
          error={new Error('The account you are looking for does not exist.')}
        />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        breadcrumbs={[{ label: 'Accounts', href: '/accounts' }, { label: account.name }]}
        actions={
          <HStack gap={2}>
            <Button variant="outline" onClick={onAddTxnOpen}>
              <HStack gap={2}>
                <FiPlus />
                <Box display={{ base: 'none', md: 'block' }}>Add Transaction</Box>
              </HStack>
            </Button>
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

      {/* Account Info Card */}
      <AccountInfoCard
        account={account}
        onEdit={() => setIsEditOpen(true)}
        onDelete={() => setShowDeleteDialog(true)}
      />

      {/* Delete Error Alert */}
      {deleteMutation.isError && deleteMutation.error && (
        <ErrorAlert title="Failed to delete account" error={deleteMutation.error} />
      )}

      {/* Transaction Filters */}
      {showFilters && (
        <TransactionFilters
          accounts={[]}
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
          from: { type: NavigationSourceType.ACCOUNT, id: account.id, name: account.name },
        }}
      />

      {/* Add Transaction Modal (account pre-selected) */}
      <TransactionFormModal
        isOpen={isAddTxnOpen}
        onClose={onAddTxnClose}
        accounts={accountsData || []}
        categories={categories}
        people={peopleData || []}
        defaultAccountId={account.id}
        onSubmit={handleCreateSubmit}
        onSubmitDebt={handleDebtSubmit}
      />

      {/* Edit Account Modal */}
      <AccountFormModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        account={account}
        onSuccess={() => setIsEditOpen(false)}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Account"
        message={`Are you sure you want to delete "${account.name}"? This action cannot be undone.`}
        confirmText="Delete"
        colorScheme="red"
        isLoading={deleteMutation.isPending}
      />
    </Box>
  );
};
