import { useState } from 'react';
import { Badge, Box, Button, HStack, Icon, Text, VStack } from '@chakra-ui/react';
import { FiRotateCcw, FiTrash2 } from 'react-icons/fi';
import { FaEuroSign } from 'react-icons/fa';
import { ConfirmDialog } from '@/components/common';
import { useRestoreTransaction, usePermanentDeleteTransaction } from '@/hooks';
import type { EnrichedTransaction } from '@/types';
import { formatCurrency, formatDate } from '@/utils/formatters';

interface TrashTransactionRowProps {
  transaction: EnrichedTransaction;
}

export const TrashTransactionRow = ({ transaction }: TrashTransactionRowProps) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const restoreMutation = useRestoreTransaction();
  const permanentDeleteMutation = usePermanentDeleteTransaction();

  const amount = parseFloat(transaction.amount);
  const isExpense = amount < 0;

  const handleRestore = () => {
    restoreMutation.mutate(transaction.id);
  };

  const handlePermanentDelete = () => {
    permanentDeleteMutation.mutate(transaction.id, {
      onSuccess: () => {
        setShowDeleteDialog(false);
      },
    });
  };

  return (
    <>
      <Box p={4} bg="bg" borderRadius="md" borderWidth="1px" borderColor="border" opacity={0.85}>
        <HStack justify="space-between" align="start" gap={3}>
          {/* Left side - Icon and details */}
          <HStack gap={3} flex={1}>
            {/* Category Icon */}
            <Box p={2} bg="gray.50" borderRadius="md">
              <Icon as={FaEuroSign} boxSize={5} color="gray.500" />
            </Box>

            {/* Transaction details */}
            <VStack align="start" gap={1} flex={1}>
              <Text fontWeight="semibold" fontSize="md">
                {transaction.title}
              </Text>

              <HStack gap={2} flexWrap="wrap">
                {/* Account badge */}
                <Badge colorScheme="gray" fontSize="xs">
                  {transaction.account.name}
                </Badge>

                {/* Category badge */}
                {transaction.category && (
                  <Badge colorScheme="blue" fontSize="xs">
                    {transaction.category.name}
                  </Badge>
                )}

                {/* Transaction date */}
                <Text fontSize="xs" color="fg.muted">
                  {formatDate(transaction.date, 'short')}
                </Text>
              </HStack>

              {/* Soft-delete metadata */}
              <HStack gap={3} flexWrap="wrap">
                {transaction.deleted_at && (
                  <Text fontSize="xs" color="red.500">
                    Deleted on {formatDate(transaction.deleted_at, 'short')}
                  </Text>
                )}
                {transaction.permanent_delete_at && (
                  <Text fontSize="xs" color="orange.500">
                    Auto-removes {formatDate(transaction.permanent_delete_at, 'short')}
                  </Text>
                )}
              </HStack>
            </VStack>
          </HStack>

          {/* Right side - Amount and actions */}
          <VStack align="end" gap={2} minW="100px">
            <Text fontWeight="bold" fontSize="lg" color={isExpense ? 'red.600' : 'green.600'}>
              {isExpense ? '-' : '+'}
              {formatCurrency(Math.abs(amount), transaction.account.currency)}
            </Text>

            <HStack gap={2}>
              <Button
                size="xs"
                variant="outline"
                colorPalette="green"
                onClick={handleRestore}
                loading={restoreMutation.isPending}
                aria-label="Restore transaction"
              >
                <Icon as={FiRotateCcw} boxSize={3} />
                Restore
              </Button>

              <Button
                size="xs"
                variant="outline"
                colorPalette="red"
                onClick={() => setShowDeleteDialog(true)}
                aria-label="Permanently delete transaction"
              >
                <Icon as={FiTrash2} boxSize={3} />
                Delete
              </Button>
            </HStack>
          </VStack>
        </HStack>
      </Box>

      {/* Permanent Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handlePermanentDelete}
        title="Permanently Delete Transaction"
        message={`This will permanently delete "${transaction.title}". This action cannot be undone.`}
        confirmText="Delete Forever"
        colorScheme="red"
        isLoading={permanentDeleteMutation.isPending}
      />
    </>
  );
};
