import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, HStack, IconButton, useDisclosure } from '@chakra-ui/react';
import { FiFilter } from 'react-icons/fi';
import { PageHeader, LoadingSpinner, ErrorAlert, ConfirmDialog } from '@/components/common';
import { CategoryInfoCard, CategoryFormModal } from '@/components/categories';
import {
  TransactionList,
  TransactionFilters,
  TransactionFormModal,
} from '@/components/transactions';
import { useCategoryDetail } from '@/hooks/usecase';
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

export const CategoryDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const {
    category,
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
    deleteMutation,
  } = useCategoryDetail(id ?? '');

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

  useDocumentTitle(category ? `${category.name} — Category` : 'Category');

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
        void navigate('/categories', { replace: true });
      },
    });
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading category..." />;
  }

  if (error) {
    return (
      <Box>
        <PageHeader
          breadcrumbs={[{ label: 'Categories', href: '/categories' }, { label: 'Error' }]}
        />
        <ErrorAlert title="Failed to load category" error={error} />
      </Box>
    );
  }

  if (!category) {
    return (
      <Box>
        <PageHeader
          breadcrumbs={[{ label: 'Categories', href: '/categories' }, { label: 'Not Found' }]}
        />
        <ErrorAlert
          title="Category not found"
          error={new Error('The category you are looking for does not exist.')}
        />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        breadcrumbs={[{ label: 'Categories', href: '/categories' }, { label: category.name }]}
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

      <CategoryInfoCard
        category={category}
        onEdit={() => setIsEditOpen(true)}
        onDelete={() => setShowDeleteDialog(true)}
      />

      {deleteMutation.isError && deleteMutation.error && (
        <ErrorAlert title="Failed to delete category" error={deleteMutation.error} />
      )}

      {showFilters && (
        <TransactionFilters
          accounts={accounts}
          categories={[]}
          filters={filters}
          onFilterChange={setFilters}
          onClear={clearFilters}
        />
      )}

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
          from: { type: NavigationSourceType.CATEGORY, id: category.id, name: category.name },
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

      <CategoryFormModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        category={category}
        onSuccess={() => setIsEditOpen(false)}
      />

      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Category"
        message={`Are you sure you want to delete "${category.name}"? This action cannot be undone.`}
        confirmText="Delete"
        colorScheme="red"
        isLoading={deleteMutation.isPending}
      />
    </Box>
  );
};
