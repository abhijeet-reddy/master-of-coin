import { Box, VStack, HStack, Text, Button, Badge, Spinner, Checkbox } from '@chakra-ui/react';
import { MdSync, MdFileDownload } from 'react-icons/md';
import { useBankSync } from '@/hooks/usecase';
import { BankBalanceDisplay } from './BankBalanceDisplay';
import type { FetchedBankTransaction } from '@/types/bankProvider';

interface BankSyncReviewProps {
  bankProviderId: string;
}

/**
 * Bank sync review panel. Allows the user to:
 * 1. Start a sync to fetch transactions from the bank
 * 2. Review fetched transactions
 * 3. Select and import transactions into Master of Coin
 */
export const BankSyncReview = ({ bankProviderId }: BankSyncReviewProps) => {
  const {
    report,
    isStarting,
    isRunning,
    isLoadingJob,
    isCompleted,
    isFailed,
    syncJob,
    newTransactions,
    selectedIds,
    isImporting,
    handleStartSync,
    toggleTransaction,
    selectAllNew,
    deselectAll,
    handleImport,
  } = useBankSync(bankProviderId);

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
                <HStack gap={2}>
                  <Button size="xs" variant="ghost" onClick={selectAllNew}>
                    Select All
                  </Button>
                  <Button size="xs" variant="ghost" onClick={deselectAll}>
                    Deselect All
                  </Button>
                </HStack>
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
                    <HStack gap={3}>
                      <Checkbox.Root
                        checked={selectedIds.has(txn.external_id)}
                        onCheckedChange={() => toggleTransaction(txn.external_id)}
                        disabled={txn.already_imported}
                      >
                        <Checkbox.HiddenInput />
                        <Checkbox.Control />
                      </Checkbox.Root>
                      <VStack align="start" gap={0}>
                        <Text fontSize="sm" fontWeight="medium">
                          {txn.description}
                        </Text>
                        <Text fontSize="xs" color="fg.muted">
                          {new Date(txn.date).toLocaleDateString()}
                          {txn.merchant_name && ` · ${txn.merchant_name}`}
                        </Text>
                      </VStack>
                    </HStack>
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

              {/* Import button */}
              <Button
                colorPalette="green"
                size="sm"
                onClick={handleImport}
                loading={isImporting}
                disabled={selectedIds.size === 0}
              >
                <Box as={MdFileDownload} mr={1} />
                Import {selectedIds.size} Transaction{selectedIds.size !== 1 ? 's' : ''}
              </Button>
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
    </VStack>
  );
};
