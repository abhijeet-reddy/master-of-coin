import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, useDisclosure } from '@chakra-ui/react';
import { PageHeader, LoadingSpinner, ErrorAlert, ConfirmDialog } from '@/components/common';
import {
  TransactionDetailCard,
  TransactionActions,
  SplitMismatchModal,
} from '@/components/transactions/detail';
import { TransactionFormModal } from '@/components/transactions';
import {
  useUpdateTransaction,
  useDeleteTransaction,
  useAccounts,
  useCategories,
  usePeople,
  useDocumentTitle,
} from '@/hooks';
import { useTransactionDetail, useSplitSync } from '@/hooks/usecase';
import type { CreateTransactionRequest } from '@/types';

export const TransactionDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { transaction, people, isLoading, error } = useTransactionDetail(id || '');

  // Data for the edit modal
  const { data: accountsData } = useAccounts();
  const { data: categoriesData } = useCategories();
  const { data: peopleData } = usePeople();

  const { open: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();

  const updateMutation = useUpdateTransaction();
  const deleteMutation = useDeleteTransaction();

  // Split sync
  const { handleSync, handleResolve, closeMismatchModal, mismatchResult, isSyncing, isResolving } =
    useSplitSync(id || '');

  useDocumentTitle(transaction ? `${transaction.title} — Transaction` : 'Transaction');

  const handleEdit = () => {
    onEditOpen();
  };

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = () => {
    if (!id) return;
    deleteMutation.mutate(id, {
      onSuccess: () => {
        setShowDeleteDialog(false);
        void navigate('/transactions', { replace: true });
      },
    });
  };

  const handleSubmit = async (data: CreateTransactionRequest) => {
    if (!id) return;
    await updateMutation.mutateAsync({ id, data });
    onEditClose();
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading transaction..." />;
  }

  if (error) {
    return (
      <Box>
        <PageHeader
          title="Transaction"
          breadcrumbs={[{ label: 'Transactions', href: '/transactions' }, { label: 'Details' }]}
        />
        <ErrorAlert title="Failed to load transaction" error={error} />
      </Box>
    );
  }

  if (!transaction) {
    return (
      <Box>
        <PageHeader
          title="Transaction Not Found"
          breadcrumbs={[{ label: 'Transactions', href: '/transactions' }, { label: 'Not Found' }]}
        />
        <ErrorAlert
          title="Transaction not found"
          error={new Error('The transaction you are looking for does not exist.')}
        />
      </Box>
    );
  }

  // Only show sync button if transaction has splits
  const hasSplits = transaction.splits && transaction.splits.length > 0;

  return (
    <Box maxW="2xl" mx="auto">
      <PageHeader
        breadcrumbs={[{ label: 'Transactions', href: '/transactions' }, { label: 'Details' }]}
        actions={
          <TransactionActions
            onEdit={handleEdit}
            onDelete={handleDelete}
            isDeleting={deleteMutation.isPending}
          />
        }
      />

      <TransactionDetailCard
        transaction={transaction}
        people={people}
        onSync={hasSplits ? handleSync : undefined}
        isSyncing={isSyncing}
      />

      {/* Split Mismatch Modal */}
      <SplitMismatchModal
        result={mismatchResult}
        onClose={closeMismatchModal}
        onResolve={handleResolve}
        isResolving={isResolving}
      />

      {/* Edit Modal */}
      <TransactionFormModal
        isOpen={isEditOpen}
        onClose={onEditClose}
        transaction={{
          id: transaction.id,
          user_id: '',
          account_id: transaction.account.id,
          category_id: transaction.category?.id,
          title: transaction.title,
          amount: transaction.amount,
          date: transaction.date,
          notes: transaction.notes,
          splits: transaction.splits,
          user_share: transaction.user_share,
          created_at: transaction.created_at,
          updated_at: transaction.updated_at,
        }}
        accounts={accountsData || []}
        categories={categoriesData || []}
        people={peopleData || []}
        onSubmit={handleSubmit}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Transaction"
        message={`Are you sure you want to delete "${transaction.title}"? This action cannot be undone.`}
        confirmText="Delete"
        colorScheme="red"
        isLoading={deleteMutation.isPending}
      />
    </Box>
  );
};
