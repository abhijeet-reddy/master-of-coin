import { useState } from 'react';
import { VStack, HStack, Text, Button, Badge, Card, Box } from '@chakra-ui/react';
import { ImportStatementModal } from '@/components/transactions/import';
import { useImportStatement } from '@/hooks/usecase/useImportStatement';
import { useAccounts, useCategories } from '@/hooks/api';
import { bankTxnToParsed, buildBankSyncMetadata } from '@/utils/bankTransactionConverter';
import type { BankSyncReport, FetchedBankTransaction } from '@/types/bankProvider';

interface BankSyncReportViewProps {
  report: BankSyncReport;
  jobId: string;
}

/**
 * Displays a bank sync report with transaction list and import functionality.
 * Clicking "Import" opens the same ImportStatementModal used by CSV import,
 * pre-loaded with bank transactions for editing.
 */
export const BankSyncReportView = ({ report }: BankSyncReportViewProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const importState = useImportStatement();
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();

  const newTransactions = report.transactions.filter((t) => !t.already_imported);

  const handleImportClick = () => {
    if (newTransactions.length === 0) return;
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
      {/* Summary */}
      <Card.Root>
        <Card.Body p={4}>
          <HStack gap={4} flexWrap="wrap">
            <Badge colorPalette="blue" size="lg">
              {report.summary.total_fetched} fetched
            </Badge>
            <Badge colorPalette="green" size="lg">
              {report.summary.new_transactions} new
            </Badge>
            <Badge colorPalette="gray" size="lg">
              {report.summary.already_imported} already imported
            </Badge>
          </HStack>

          {/* Balance */}
          {report.balance && (
            <HStack gap={4} mt={3}>
              <Text fontSize="sm">
                <Text as="span" color="fg.muted">
                  Balance:
                </Text>{' '}
                <Text as="span" fontWeight="semibold">
                  {report.balance.currency} {report.balance.current}
                </Text>
              </Text>
              {report.balance.available && (
                <Text fontSize="sm">
                  <Text as="span" color="fg.muted">
                    Available:
                  </Text>{' '}
                  <Text as="span" fontWeight="semibold">
                    {report.balance.currency} {report.balance.available}
                  </Text>
                </Text>
              )}
            </HStack>
          )}
        </Card.Body>
      </Card.Root>

      {/* Transaction list */}
      {newTransactions.length > 0 && (
        <Card.Root>
          <Card.Body p={4}>
            <VStack align="stretch" gap={3}>
              <HStack justify="space-between">
                <Text fontWeight="semibold">New Transactions ({newTransactions.length})</Text>
                <Button colorPalette="green" size="sm" onClick={handleImportClick}>
                  Import
                </Button>
              </HStack>

              <Box maxH="500px" overflowY="auto">
                {report.transactions.map((txn: FetchedBankTransaction) => (
                  <HStack
                    key={txn.external_id}
                    p={3}
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
          </Card.Body>
        </Card.Root>
      )}

      {newTransactions.length === 0 && report.summary.total_fetched > 0 && (
        <Card.Root>
          <Card.Body p={4}>
            <Text color="fg.muted">All fetched transactions have already been imported.</Text>
          </Card.Body>
        </Card.Root>
      )}

      {report.summary.total_fetched === 0 && (
        <Card.Root>
          <Card.Body p={4}>
            <Text color="fg.muted">No transactions found for the selected period.</Text>
          </Card.Body>
        </Card.Root>
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
