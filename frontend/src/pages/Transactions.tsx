import { useState, useMemo } from 'react';
import { Box, Button, HStack, IconButton, useDisclosure } from '@chakra-ui/react';
import { FiPlus, FiFilter, FiUpload, FiRepeat } from 'react-icons/fi';
import { PageHeader, LoadingSpinner, ErrorAlert, ConfirmDialog } from '@/components/common';
import {
  MonthNavigator,
  MonthSummary,
  TransactionList,
  TransactionFilters,
  TransactionFormModal,
  TransferFormModal,
  type TransactionFilterValues,
} from '@/components/transactions';
import { ImportStatementModal } from '@/components/transactions/import';
import {
  useTransactions,
  useEnrichedTransactions,
  useAccounts,
  useCategories,
  usePeople,
  useCreateTransaction,
  useCreateDebtTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
  useDocumentTitle,
} from '@/hooks';
import { useTransactionCurrencyConverter } from '@/hooks/usecase/useTransactionCurrencyConverter';
import { updateDebtExpenseDetails } from '@/services/transactionService';
import { useQueryClient } from '@tanstack/react-query';
import type {
  EnrichedTransaction,
  CreateTransactionRequest,
  CreateDebtTransactionRequest,
  UpdateExpenseDetailsRequest,
} from '@/types';

export const TransactionsPage = () => {
  useDocumentTitle('Transactions');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showFilters, setShowFilters] = useState(false);
  const [editTransaction, setEditTransaction] = useState<EnrichedTransaction | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    transaction: EnrichedTransaction | null;
  }>({
    isOpen: false,
    transaction: null,
  });
  const [filters, setFilters] = useState<TransactionFilterValues>({
    accountIds: [],
    categoryIds: [],
    transactionType: 'all',
  });

  const { open: isModalOpen, onOpen: onModalOpen, onClose: onModalClose } = useDisclosure();
  const {
    open: isTransferModalOpen,
    onOpen: onTransferModalOpen,
    onClose: onTransferModalClose,
  } = useDisclosure();
  const {
    open: isImportModalOpen,
    onOpen: onImportModalOpen,
    onClose: onImportModalClose,
  } = useDisclosure();

  // Fetch data
  const { data: accountsData } = useAccounts();
  const { data: categoriesData } = useCategories();
  const { data: peopleData } = usePeople();

  // Get transactions for selected month
  const monthStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);

  const monthEnd = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);
  monthEnd.setHours(23, 59, 59, 999);

  const {
    data: transactionsData,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useTransactions({
    start_date: monthStart.toISOString(),
    end_date: monthEnd.toISOString(),
  });

  // Flatten all pages of transactions into a single array
  const allTransactions = transactionsData?.pages.flatMap((page) => page.data) ?? [];
  const enrichedTransactions = useEnrichedTransactions(allTransactions);

  // Mutations
  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const deleteMutation = useDeleteTransaction();

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    if (!enrichedTransactions) return [];

    return enrichedTransactions.filter((transaction) => {
      // Account filter
      if (filters.accountIds.length > 0 && !filters.accountIds.includes(transaction.account.id)) {
        return false;
      }

      // Category filter
      if (
        filters.categoryIds.length > 0 &&
        (!transaction.category || !filters.categoryIds.includes(transaction.category.id))
      ) {
        return false;
      }

      // Transaction type filter
      const amount = parseFloat(transaction.amount);
      if (filters.transactionType === 'income' && amount < 0) return false;
      if (filters.transactionType === 'expense' && amount > 0) return false;

      // Date range filter
      if (filters.startDate) {
        const transactionDate = new Date(transaction.date);
        const filterStart = new Date(filters.startDate);
        if (transactionDate < filterStart) return false;
      }

      if (filters.endDate) {
        const transactionDate = new Date(transaction.date);
        const filterEnd = new Date(filters.endDate);
        if (transactionDate > filterEnd) return false;
      }

      // Amount range filter
      const absAmount = Math.abs(amount);
      if (filters.minAmount && absAmount < parseFloat(filters.minAmount)) return false;
      if (filters.maxAmount && absAmount > parseFloat(filters.maxAmount)) return false;

      // Paid by others filter
      if (filters.paidByOthers === 'only' && !transaction.debt_metadata) return false;
      if (filters.paidByOthers === 'exclude' && transaction.debt_metadata) return false;

      return true;
    });
  }, [enrichedTransactions, filters]);

  // Use transaction currency converter for accurate conversion
  const { convertAmount, isLoading: isExchangeRatesLoading } =
    useTransactionCurrencyConverter(filteredTransactions);

  // Calculate month summary with currency conversion
  const monthSummary = useMemo(() => {
    // If exchange rates are still loading, return zeros
    if (isExchangeRatesLoading) {
      return { income: 0, expenses: 0 };
    }

    const income = filteredTransactions
      .filter((t) => parseFloat(t.amount) > 0)
      .reduce((sum, t) => {
        const amount = parseFloat(t.amount);
        const converted = convertAmount(amount, t.account.currency);
        return sum + converted;
      }, 0);

    const expenses = Math.abs(
      filteredTransactions
        .filter((t) => parseFloat(t.amount) < 0)
        .reduce((sum, t) => {
          const amount = parseFloat(t.amount);
          const converted = convertAmount(amount, t.account.currency);
          return sum + converted;
        }, 0)
    );

    return { income, expenses };
  }, [filteredTransactions, convertAmount, isExchangeRatesLoading]);

  const handleAddTransaction = () => {
    setEditTransaction(null);
    onModalOpen();
  };

  const handleEditTransaction = (transaction: EnrichedTransaction) => {
    setEditTransaction(transaction);
    onModalOpen();
  };

  const handleModalClose = () => {
    setEditTransaction(null);
    onModalClose();
  };

  const handleSubmit = async (data: CreateTransactionRequest) => {
    if (editTransaction) {
      await updateMutation.mutateAsync({ id: editTransaction.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  const queryClient = useQueryClient();
  const debtMutation = useCreateDebtTransaction();
  const handleDebtSubmit = async (data: CreateDebtTransactionRequest) => {
    await debtMutation.mutateAsync(data);
  };

  const handleDebtMetadataSubmit = async (
    transactionId: string,
    data: UpdateExpenseDetailsRequest
  ) => {
    await updateDebtExpenseDetails(transactionId, data);
    await queryClient.invalidateQueries({ queryKey: ['transactions'] });
  };

  const handleDeleteTransaction = (transaction: EnrichedTransaction) => {
    setDeleteDialog({ isOpen: true, transaction });
  };

  const handleConfirmDelete = () => {
    if (deleteDialog.transaction) {
      deleteMutation.mutate(deleteDialog.transaction.id, {
        onSuccess: () => {
          setDeleteDialog({ isOpen: false, transaction: null });
        },
      });
    }
  };

  const handleClearFilters = () => {
    setFilters({
      accountIds: [],
      categoryIds: [],
      transactionType: 'all',
    });
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <Box>
        <PageHeader title="Transactions" />
        <ErrorAlert title="Failed to load transactions" error={error} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <PageHeader
        title="Transactions"
        subtitle="Track your income and expenses"
        actions={
          <HStack gap={2}>
            <IconButton
              aria-label="Toggle filters"
              variant={showFilters ? 'solid' : 'outline'}
              onClick={() => setShowFilters(!showFilters)}
            >
              <FiFilter />
            </IconButton>
            <Button variant="outline" onClick={onTransferModalOpen}>
              <HStack gap={2}>
                <FiRepeat />
                <Box display={{ base: 'none', md: 'block' }}>Transfer</Box>
              </HStack>
            </Button>
            <Button variant="outline" onClick={onImportModalOpen}>
              <HStack gap={2}>
                <FiUpload />
                <Box display={{ base: 'none', md: 'block' }}>Import</Box>
              </HStack>
            </Button>
            <Button colorScheme="blue" onClick={handleAddTransaction}>
              <HStack gap={2}>
                <FiPlus />
                <Box display={{ base: 'none', md: 'block' }}>Add Transaction</Box>
              </HStack>
            </Button>
          </HStack>
        }
      />

      {/* Month Navigator */}
      <MonthNavigator selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />

      {/* Month Summary */}
      <MonthSummary income={monthSummary.income} expenses={monthSummary.expenses} />

      {/* Filters */}
      {showFilters && (
        <TransactionFilters
          accounts={accountsData || []}
          categories={categoriesData || []}
          filters={filters}
          onFilterChange={setFilters}
          onClear={handleClearFilters}
        />
      )}

      {/* Transaction List — clicking row navigates to detail, edit icon opens modal */}
      <TransactionList
        transactions={filteredTransactions}
        isLoading={isLoading}
        onTransactionEdit={handleEditTransaction}
        onTransactionDelete={handleDeleteTransaction}
        onLoadMore={() => {
          void fetchNextPage();
        }}
        hasMore={hasNextPage}
        isFetchingMore={isFetchingNextPage}
      />

      {/* Transaction Form Modal (create & edit) */}
      <TransactionFormModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        transaction={
          editTransaction
            ? {
                id: editTransaction.id,
                user_id: '',
                account_id: editTransaction.account.id,
                category_id: editTransaction.category?.id,
                title: editTransaction.title,
                amount: editTransaction.amount,
                date: editTransaction.date,
                notes: editTransaction.notes,
                splits: editTransaction.splits,
                user_share: editTransaction.user_share,
                debt_metadata: editTransaction.debt_metadata,
                created_at: editTransaction.created_at,
                updated_at: editTransaction.updated_at,
              }
            : undefined
        }
        accounts={accountsData || []}
        categories={categoriesData || []}
        people={peopleData || []}
        onSubmit={handleSubmit}
        onSubmitDebt={handleDebtSubmit}
        onSubmitDebtMetadata={handleDebtMetadataSubmit}
      />

      {/* Floating Action Button for Mobile */}
      <IconButton
        aria-label="Add transaction"
        position="fixed"
        bottom={4}
        right={4}
        size="lg"
        colorScheme="blue"
        borderRadius="full"
        boxShadow="lg"
        display={{ base: 'flex', md: 'none' }}
        onClick={handleAddTransaction}
      >
        <FiPlus size={24} />
      </IconButton>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, transaction: null })}
        onConfirm={handleConfirmDelete}
        title="Delete Transaction"
        message={`Are you sure you want to delete "${deleteDialog.transaction?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        colorScheme="red"
        isLoading={deleteMutation.isPending}
      />

      {/* Transfer Form Modal */}
      <TransferFormModal
        open={isTransferModalOpen}
        onClose={onTransferModalClose}
        accounts={accountsData || []}
        categories={categoriesData || []}
      />

      {/* Import Statement Modal */}
      <ImportStatementModal
        isOpen={isImportModalOpen}
        onClose={onImportModalClose}
        accounts={accountsData || []}
        categories={categoriesData || []}
      />
    </Box>
  );
};
