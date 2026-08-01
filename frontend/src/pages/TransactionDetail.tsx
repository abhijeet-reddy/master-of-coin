import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Box, useDisclosure } from '@chakra-ui/react';
import { PageHeader, LoadingSpinner, ErrorAlert, ConfirmDialog } from '@/components/common';
import {
  TransactionDetailCard,
  TransactionActions,
  SplitMismatchModal,
  DeletedTransactionBanner,
} from '@/components/transactions/detail';
import { TransactionFormModal, ConvertToTransferModal } from '@/components/transactions';
import {
  useUpdateTransaction,
  useDeleteTransaction,
  useCreateTransaction,
  useCreateDebtTransaction,
  useRestoreTransaction,
  useAccounts,
  useCategories,
  usePeople,
  useDocumentTitle,
} from '@/hooks';
import { useTransactionDetail, useSplitSync } from '@/hooks/usecase';
import { updateDebtExpenseDetails } from '@/services/transactionService';
import { buildDuplicateDefaults } from '@/utils/transactionDuplicate';
import { useQueryClient } from '@tanstack/react-query';
import { NavigationSourceType } from '@/types';
import type {
  CreateTransactionRequest,
  CreateDebtTransactionRequest,
  UpdateExpenseDetailsRequest,
  TransactionNavigationState,
} from '@/types';

/** Build breadcrumbs based on the navigation source. */
const buildBreadcrumbs = (
  navState: TransactionNavigationState | null,
  transactionLabel: string
) => {
  if (navState?.from) {
    switch (navState.from.type) {
      case NavigationSourceType.ACCOUNT:
        return [
          { label: 'Accounts', href: '/accounts' },
          { label: navState.from.name || 'Account', href: `/accounts/${navState.from.id}` },
          { label: transactionLabel },
        ];
      case NavigationSourceType.CATEGORY:
        return [
          { label: 'Categories', href: '/categories' },
          { label: navState.from.name || 'Category', href: `/categories/${navState.from.id}` },
          { label: transactionLabel },
        ];
      case NavigationSourceType.BUDGET:
        return [
          { label: 'Budgets', href: '/budgets' },
          { label: navState.from.name || 'Budget', href: `/budgets/${navState.from.id}` },
          { label: transactionLabel },
        ];
      default:
        break;
    }
  }

  return [{ label: 'Transactions', href: '/transactions' }, { label: transactionLabel }];
};

/** Determine the redirect path after deleting a transaction. */
const getDeleteRedirect = (navState: TransactionNavigationState | null): string => {
  if (navState?.from) {
    switch (navState.from.type) {
      case NavigationSourceType.ACCOUNT:
        return `/accounts/${navState.from.id}`;
      case NavigationSourceType.CATEGORY:
        return `/categories/${navState.from.id}`;
      case NavigationSourceType.BUDGET:
        return `/budgets/${navState.from.id}`;
      default:
        break;
    }
  }
  return '/transactions';
};

export const TransactionDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const queryClient = useQueryClient();

  const navState = (location.state as TransactionNavigationState) ?? null;

  const { transaction, people, isLoading, error } = useTransactionDetail(id || '');

  // Data for the edit modal
  const { data: accountsData } = useAccounts();
  const { data: categoriesData } = useCategories();
  const { data: peopleData } = usePeople();

  const { open: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
  const {
    open: isDuplicateOpen,
    onOpen: onDuplicateOpen,
    onClose: onDuplicateClose,
  } = useDisclosure();
  const {
    open: isConvertOpen,
    onOpen: onConvertOpen,
    onClose: onConvertClose,
  } = useDisclosure();

  const updateMutation = useUpdateTransaction();
  const deleteMutation = useDeleteTransaction();
  const createMutation = useCreateTransaction();
  const debtMutation = useCreateDebtTransaction();
  const restoreMutation = useRestoreTransaction();

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
        void navigate(getDeleteRedirect(navState), { replace: true });
      },
    });
  };

  const handleSubmit = async (data: CreateTransactionRequest) => {
    if (!id) return;
    await updateMutation.mutateAsync({ id, data });
    onEditClose();
  };

  const handleDebtMetadataSubmit = async (
    transactionId: string,
    data: UpdateExpenseDetailsRequest
  ) => {
    await updateDebtExpenseDetails(transactionId, data);
    await queryClient.invalidateQueries({ queryKey: ['transactions'] });
    await queryClient.invalidateQueries({ queryKey: ['transaction', id] });
  };

  const handleDuplicate = () => {
    onDuplicateOpen();
  };

  const handleDuplicateSubmit = async (data: CreateTransactionRequest) => {
    await createMutation.mutateAsync(data);
    onDuplicateClose();
  };

  const handleDuplicateDebtSubmit = async (data: CreateDebtTransactionRequest) => {
    await debtMutation.mutateAsync(data);
    onDuplicateClose();
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading transaction..." />;
  }

  if (error) {
    return (
      <Box>
        <PageHeader title="Transaction" breadcrumbs={buildBreadcrumbs(navState, 'Details')} />
        <ErrorAlert title="Failed to load transaction" error={error} />
      </Box>
    );
  }

  if (!transaction) {
    return (
      <Box>
        <PageHeader
          title="Transaction Not Found"
          breadcrumbs={buildBreadcrumbs(navState, 'Not Found')}
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

  // "Convert to transfer" is only offered for a plain transaction: not one that
  // has splits, and not one that is already part of a transfer.
  const canConvertToTransfer = !hasSplits && !transaction.transfer_info;

  const isDeleted = !!transaction.deleted_at;

  const handleRestore = () => {
    if (!id) return;
    restoreMutation.mutate(id);
  };

  return (
    <Box maxW="2xl" mx="auto">
      <PageHeader
        breadcrumbs={buildBreadcrumbs(navState, transaction.title)}
        actions={
          // A soft-deleted record offers no mutating actions here — Restore
          // lives in the banner below and is the only available action.
          isDeleted ? undefined : (
            <TransactionActions
              onEdit={handleEdit}
              onDelete={handleDelete}
              onDuplicate={!transaction.transfer_info ? handleDuplicate : undefined}
              onConvertToTransfer={canConvertToTransfer ? onConvertOpen : undefined}
              isDeleting={deleteMutation.isPending}
            />
          )
        }
      />

      {isDeleted && transaction.deleted_at && (
        <DeletedTransactionBanner
          deletedAt={transaction.deleted_at}
          permanentDeleteAt={transaction.permanent_delete_at}
          onRestore={handleRestore}
          isRestoring={restoreMutation.isPending}
        />
      )}

      <Box opacity={isDeleted ? 0.6 : 1}>
        <TransactionDetailCard
          transaction={transaction}
          people={people}
          onSync={!isDeleted && hasSplits ? handleSync : undefined}
          isSyncing={isSyncing}
          isDeleted={isDeleted}
        />
      </Box>

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
          debt_metadata: transaction.debt_metadata,
          created_at: transaction.created_at,
          updated_at: transaction.updated_at,
        }}
        accounts={accountsData || []}
        categories={categoriesData || []}
        people={peopleData || []}
        onSubmit={handleSubmit}
        onSubmitDebtMetadata={handleDebtMetadataSubmit}
      />

      {/* Duplicate Modal */}
      <TransactionFormModal
        isOpen={isDuplicateOpen}
        onClose={onDuplicateClose}
        defaultValues={
          transaction
            ? buildDuplicateDefaults({
                ...transaction,
                amount: transaction.amount,
                date: transaction.date,
                created_at: transaction.created_at,
                updated_at: transaction.updated_at,
              })
            : undefined
        }
        accounts={accountsData || []}
        categories={categoriesData || []}
        people={peopleData || []}
        onSubmit={handleDuplicateSubmit}
        onSubmitDebt={handleDuplicateDebtSubmit}
      />

      {/* Convert to Transfer Modal */}
      <ConvertToTransferModal
        open={isConvertOpen}
        onClose={onConvertClose}
        transactionId={transaction.id}
        transactionAccountId={transaction.account.id}
        transactionAmount={transaction.amount}
        transactionCurrency={transaction.account.currency}
        accounts={accountsData || []}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Transaction"
        message={`Are you sure you want to delete "${transaction.title}"? This transaction will be moved to trash and permanently deleted after 30 days.`}
        confirmText="Delete"
        colorScheme="red"
        isLoading={deleteMutation.isPending}
      />
    </Box>
  );
};
