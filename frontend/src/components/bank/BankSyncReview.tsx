import { useState } from 'react';
import { Box, VStack, HStack, Text, Button, Badge, Spinner } from '@chakra-ui/react';
import { MdSync } from 'react-icons/md';
import { ImportStatementModal } from '@/components/transactions/import';
import { useImportStatement } from '@/hooks/usecase/useImportStatement';
import { useBankSync } from '@/hooks/usecase';
import { useAccounts, useCategories } from '@/hooks/api';
import { bankTxnToParsed, buildBankSyncMetadata } from '@/utils/bankTransactionConverter';
import { BankBalanceDisplay } from './BankBalanceDisplay';
import type { FetchedBankTransaction } from '@/types/bankProvider';

interface BankSyncReviewProps {
  bankProviderId: string;
}

/**
 * Bank sync review panel. Allows the user to:
 * 1. Start a sync to fetch transactions from the bank
 * 2. Review fetched transactions
 * 3. Click Import to open the preview/edit modal before importing
 */
export const BankSyncReview = ({ bankProviderId }: BankSyncReviewProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const importState = useImportStatement();

  const {
    report,
    isStarting,
    isRunning,
    isLoadingJob,
    isCompleted,
    isFailed,
    syncJob,
    newTransactions,
    handleStartSync,
  } = useBankSync(bankProviderId);

  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();

  const handleImportClick = () => {
    if (!report || newTransactions.length === 0) return;
    const parsed = newTransactions.map(bankTxnToParsed);
    const metadata = buildBankSyncMetadata(report.bank_provider_id, newTransactions);
    importState.loadTransactions(parsed, report.account_id, metadata);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    importState.resetState();
    setIsModalOpen(false);
  };

  return (
    <VStack align="stretch" gap={4}>
      {/* Sync button */}
      <HStack justify="space-between">
        <Text fontWeight="semibold" fontSize="sm">
          Bank Transactions
        </Text>
        <Button
          size="sm"
          colorPalette="blue"
          onClick={() => handleStartSync()}
          loading={isStarting || isRunning}
          loadingText={isRunning ? 'Syncing...' : 'Starting...'}
        >
          <Box as={MdSync} mr={1} />
          Sync Transactions
        </Button>
      </HStack>

      {/* Loading state */}
      {(isRunning || isLoadingJob) && (
        <HStack gap={2} p={3} borderWidth="1px" borderRadius="md">
          <Spinner size="sm" />
          <Text fontSize="sm">Fetching transactions from your bank...</Text>
        </HStack>
      )}

      {/* Error state */}
      {isFailed && syncJob?.error && (
        <Box p={3} borderWidth="1px" borderRadius="md" borderColor="red.300" bg="red.50">
          <Text fontSize="sm" color="red.700">
            Sync failed: {syncJob.error}
          </Text>
        </Box>
      )}

      {/* Results */}
      {isCompleted && report && (
        <VStack align="stretch" gap={3}>
          {/* Balance */}
          {report.balance && <BankBalanceDisplay balance={report.balance} isLoading={false} />}

          {/* Summary */}
          <HStack gap={4} flexWrap="wrap">
            <Badge colorPalette="blue" size="sm">
              {report.summary.total_fetched} fetched
            </Badge>
            <Badge colorPalette="green" size="sm">
              {report.summary.new_transactions} new
            </Badge>
            <Badge colorPalette="gray" size="sm">
              {report.summary.already_imported} already imported
            </Badge>
          </HStack>

          {/* Transaction list */}
          {newTransactions.length > 0 && (
            <VStack align="stretch" gap={2}>
              <HStack justify="space-between">
                <Text fontSize="sm" fontWeight="medium">
                  New transactions ({newTransactions.length})
                </Text>
                <Button colorPalette="green" size="sm" onClick={handleImportClick}>
                  Import
                </Button>
              </HStack>

              <Box maxH="400px" overflowY="auto" borderWidth="1px" borderRadius="md">
                {report.transactions.map((txn: FetchedBankTransaction) => (
                  <HStack
                    key={txn.external_id}
                    p={2}
                    borderBottomWidth="1px"
                    justify="space-between"
                    opacity={txn.already_imported ? 0.5 : 1}
                    _last={{ borderBottomWidth: 0 }}
                  >
                    <VStack align="start" gap={0}>
                      <Text fontSize="sm" fontWeight="medium">
                        {txn.description}
                      </Text>
                      <Text fontSize="xs" color="fg.muted">
                        {new Date(txn.date).toLocaleDateString()}
                        {txn.merchant_name && ` · ${txn.merchant_name}`}
                      </Text>
                    </VStack>
                    <HStack gap={2}>
                      <Text
                        fontSize="sm"
                        fontWeight="semibold"
                        color={txn.transaction_type === 'CREDIT' ? 'green.600' : 'red.600'}
                      >
                        {txn.transaction_type === 'CREDIT' ? '+' : '-'}
                        {txn.currency} {Math.abs(parseFloat(txn.amount)).toFixed(2)}
                      </Text>
                      {txn.already_imported && (
                        <Badge size="sm" colorPalette="gray">
                          Imported
                        </Badge>
                      )}
                    </HStack>
                  </HStack>
                ))}
              </Box>
            </VStack>
          )}

          {newTransactions.length === 0 && report.summary.total_fetched > 0 && (
            <Text fontSize="sm" color="fg.muted">
              All fetched transactions have already been imported.
            </Text>
          )}

          {report.summary.total_fetched === 0 && (
            <Text fontSize="sm" color="fg.muted">
              No transactions found for the selected period.
            </Text>
          )}
        </VStack>
      )}

      {/* Reuse the same ImportStatementModal, sharing the hook state */}
      <ImportStatementModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        accounts={accounts ?? []}
        categories={categories ?? []}
        importState={importState}
      />
    </VStack>
  );
};
