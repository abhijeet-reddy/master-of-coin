import {
  Box,
  Button,
  HStack,
  VStack,
  Text,
  Input,
  IconButton,
  Badge,
  Table,
  Checkbox,
} from '@chakra-ui/react';
import { FiTrash2 } from 'react-icons/fi';
import type { ParsedTransaction } from '@/types';
import { useTransactionPreview } from '@/hooks/usecase/useTransactionPreview';
import {
  calculateTransactionSummary,
  getConfidenceColor,
  formatAmount,
} from '@/utils/transactionImport';

interface TransactionPreviewStepProps {
  transactions: ParsedTransaction[];
  accountId: string;
  onImport: (
    transactions: Array<{
      account_id: string;
      title: string;
      amount: number;
      date: string;
      notes?: string;
    }>
  ) => void;
  onBack: () => void;
  isProcessing: boolean;
}

export const TransactionPreviewStep = ({
  transactions,
  accountId,
  onImport,
  onBack,
  isProcessing,
}: TransactionPreviewStepProps) => {
  const {
    selectedTransactions,
    toggleTransaction,
    toggleAll,
    updateTransaction,
    deleteTransaction,
    isAllSelected,
    selectedCount,
    getTransactionData,
  } = useTransactionPreview(transactions);

  const summary = calculateTransactionSummary(transactions, selectedTransactions);

  const handleImport = () => {
    const transactionsToImport = transactions
      .filter((t) => selectedTransactions.has(t.temp_id))
      .map((t) => {
        const data = getTransactionData(t.temp_id, t);
        return {
          account_id: accountId,
          title: data.title,
          amount: parseFloat(data.amount),
          date: data.date,
          notes: data.notes,
        };
      });

    onImport(transactionsToImport);
  };

  const canImport = selectedCount > 0 && !isProcessing;

  return (
    <VStack gap={6} align="stretch">
      {/* Summary Card */}
      <Box p={4} bg="blue.50" borderRadius="md" borderWidth={1} borderColor="blue.200">
        <HStack justify="space-between" flexWrap="wrap" gap={4}>
          <VStack align="start" gap={1}>
            <Text fontSize="sm" fontWeight="medium" color="blue.800">
              Total Selected
            </Text>
            <Text fontSize="2xl" fontWeight="bold" color="blue.600">
              {selectedCount}
            </Text>
          </VStack>
          <VStack align="start" gap={1}>
            <Text fontSize="sm" fontWeight="medium" color="green.800">
              Income
            </Text>
            <Text fontSize="lg" fontWeight="semibold" color="green.600">
              +{formatAmount(summary.income)}
            </Text>
          </VStack>
          <VStack align="start" gap={1}>
            <Text fontSize="sm" fontWeight="medium" color="red.800">
              Expenses
            </Text>
            <Text fontSize="lg" fontWeight="semibold" color="red.600">
              -{formatAmount(summary.expenses)}
            </Text>
          </VStack>
          {summary.duplicates > 0 && (
            <VStack align="start" gap={1}>
              <Text fontSize="sm" fontWeight="medium" color="yellow.800">
                Duplicates
              </Text>
              <Text fontSize="lg" fontWeight="semibold" color="yellow.600">
                {summary.duplicates}
              </Text>
            </VStack>
          )}
        </HStack>
      </Box>

      {/* Transactions Table */}
      <Box overflowX="auto" borderWidth={1} borderRadius="md">
        <Table.Root size="sm">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>
                <Checkbox.Root
                  checked={isAllSelected}
                  onCheckedChange={toggleAll}
                  disabled={isProcessing}
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control />
                </Checkbox.Root>
              </Table.ColumnHeader>
              <Table.ColumnHeader>Date</Table.ColumnHeader>
              <Table.ColumnHeader>Title</Table.ColumnHeader>
              <Table.ColumnHeader>Amount</Table.ColumnHeader>
              <Table.ColumnHeader>Duplicate</Table.ColumnHeader>
              <Table.ColumnHeader>Actions</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {transactions.map((transaction) => {
              const data = getTransactionData(transaction.temp_id, transaction);
              const isSelected = selectedTransactions.has(transaction.temp_id);
              const bgColor = transaction.is_potential_duplicate
                ? 'yellow.50'
                : !transaction.is_valid
                  ? 'red.50'
                  : undefined;

              return (
                <Table.Row key={transaction.temp_id} bg={bgColor}>
                  <Table.Cell>
                    <Checkbox.Root
                      checked={isSelected}
                      onCheckedChange={() => toggleTransaction(transaction.temp_id)}
                      disabled={isProcessing}
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control />
                    </Checkbox.Root>
                  </Table.Cell>
                  <Table.Cell>
                    <Input
                      type="date"
                      value={data.date.split('T')[0]}
                      onChange={(e) =>
                        updateTransaction(transaction.temp_id, { date: e.target.value })
                      }
                      size="sm"
                      disabled={isProcessing}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <Input
                      value={data.title}
                      onChange={(e) =>
                        updateTransaction(transaction.temp_id, { title: e.target.value })
                      }
                      size="sm"
                      disabled={isProcessing}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <Input
                      type="number"
                      step="0.01"
                      value={data.amount}
                      onChange={(e) =>
                        updateTransaction(transaction.temp_id, { amount: e.target.value })
                      }
                      size="sm"
                      disabled={isProcessing}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <HStack gap={1}>
                      {transaction.is_potential_duplicate && transaction.duplicate_match && (
                        <Badge
                          colorScheme={getConfidenceColor(transaction.duplicate_match.confidence)}
                        >
                          Duplicate ({transaction.duplicate_match.confidence})
                        </Badge>
                      )}
                      {!transaction.is_valid && <Badge colorScheme="red">Invalid</Badge>}
                    </HStack>
                  </Table.Cell>
                  <Table.Cell>
                    <IconButton
                      aria-label="Delete transaction"
                      size="sm"
                      variant="ghost"
                      colorScheme="red"
                      onClick={() => deleteTransaction(transaction.temp_id)}
                      disabled={isProcessing}
                    >
                      <FiTrash2 />
                    </IconButton>
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Root>
      </Box>

      {/* Action Buttons */}
      <HStack justify="space-between">
        <Button variant="outline" onClick={onBack} disabled={isProcessing}>
          Back
        </Button>
        <Button
          colorScheme="blue"
          onClick={handleImport}
          disabled={!canImport}
          loading={isProcessing}
          loadingText="Importing..."
        >
          Import {selectedCount} Transaction{selectedCount !== 1 ? 's' : ''}
        </Button>
      </HStack>
    </VStack>
  );
};
