import { useState } from 'react';
import { Box, VStack, HStack, Text, Button, Badge, Card, Checkbox } from '@chakra-ui/react';
import { useImportBankTransactions } from '@/hooks/api/useBankProviders';
import { toaster } from '@/components/ui/toaster';
import type { BankSyncReport, FetchedBankTransaction } from '@/types/bankProvider';

interface BankSyncReportViewProps {
  report: BankSyncReport;
  jobId: string;
}

/**
 * Displays a bank sync report with transaction review and import functionality.
 * Used in the Job Detail page for BANK_SYNC jobs.
 */
export const BankSyncReportView = ({ report, jobId }: BankSyncReportViewProps) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const importMutation = useImportBankTransactions();

  const newTransactions = report.transactions.filter((t) => !t.already_imported);

  const toggleTransaction = (externalId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(externalId)) {
        next.delete(externalId);
      } else {
        next.add(externalId);
      }
      return next;
    });
  };

  const selectAllNew = () => {
    setSelectedIds(new Set(newTransactions.map((t) => t.external_id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleImport = () => {
    if (selectedIds.size === 0) return;
    importMutation.mutate(
      { jobId, transactionIds: Array.from(selectedIds) },
      {
        onSuccess: (result) => {
          toaster.create({
            title: 'Import Complete',
            description: `${result.imported_count} transaction(s) imported.${
              result.skipped_count > 0 ? ` ${result.skipped_count} skipped.` : ''
            }`,
            type: 'success',
          });
          setSelectedIds(new Set());
        },
        onError: (error) => {
          const message = error instanceof Error ? error.message : 'Could not import transactions.';
          toaster.create({
            title: 'Import Failed',
            description: message,
            type: 'error',
          });
        },
      }
    );
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
                <HStack gap={2}>
                  <Button size="xs" variant="ghost" onClick={selectAllNew}>
                    Select All
                  </Button>
                  <Button size="xs" variant="ghost" onClick={deselectAll}>
                    Deselect All
                  </Button>
                  <Button
                    colorPalette="green"
                    size="xs"
                    onClick={handleImport}
                    loading={importMutation.isPending}
                    disabled={selectedIds.size === 0}
                  >
                    Import ({selectedIds.size})
                  </Button>
                </HStack>
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
    </VStack>
  );
};
