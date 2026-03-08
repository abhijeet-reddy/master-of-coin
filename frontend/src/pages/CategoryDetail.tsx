import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, HStack, IconButton } from '@chakra-ui/react';
import { FiFilter } from 'react-icons/fi';
import { PageHeader, LoadingSpinner, ErrorAlert, ConfirmDialog } from '@/components/common';
import { CategoryInfoCard, CategoryFormModal } from '@/components/categories';
import { TransactionList, TransactionFilters } from '@/components/transactions';
import { useCategoryDetail } from '@/hooks/usecase';
import { useDocumentTitle } from '@/hooks';
import { NavigationSourceType } from '@/types';

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

  useDocumentTitle(category ? `${category.name} — Category` : 'Category');

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
        onLoadMore={() => {
          void fetchNextPage();
        }}
        hasMore={hasNextPage}
        isFetchingMore={isFetchingNextPage}
        navigationState={{
          from: { type: NavigationSourceType.CATEGORY, id: category.id, name: category.name },
        }}
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
