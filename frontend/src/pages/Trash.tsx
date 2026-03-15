import { Box, Center, Spinner, Stack, VStack } from '@chakra-ui/react';
import { FiTrash2 } from 'react-icons/fi';
import { PageHeader, LoadingSpinner, ErrorAlert, EmptyState } from '@/components/common';
import { TrashTransactionRow } from '@/components/transactions/TrashTransactionRow';
import { useTrashTransactions, useEnrichedTransactions, useDocumentTitle } from '@/hooks';

export const TrashPage = () => {
  useDocumentTitle('Trash');

  const {
    data: trashData,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useTrashTransactions();

  // Flatten all pages of transactions into a single array
  const allTransactions = trashData?.pages.flatMap((page) => page.data) ?? [];
  const enrichedTransactions = useEnrichedTransactions(allTransactions);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <Box>
        <PageHeader title="Trash" />
        <ErrorAlert title="Failed to load trash" error={error} />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Trash"
        subtitle="Deleted transactions are permanently removed after 30 days"
      />

      {enrichedTransactions.length === 0 ? (
        <EmptyState
          icon={<FiTrash2 size={40} />}
          title="No deleted transactions"
          description="Transactions you delete will appear here for 30 days before being permanently removed"
        />
      ) : (
        <VStack align="stretch" gap={3}>
          <Stack gap={2}>
            {enrichedTransactions.map((transaction) => (
              <TrashTransactionRow key={transaction.id} transaction={transaction} />
            ))}
          </Stack>

          {/* Loading more indicator */}
          {isFetchingNextPage && (
            <Center py={4}>
              <Spinner size="md" color="blue.500" />
            </Center>
          )}

          {/* Load more button */}
          {hasNextPage && !isFetchingNextPage && (
            <Center py={4}>
              <Box
                as="button"
                px={4}
                py={2}
                fontSize="sm"
                color="blue.500"
                fontWeight="medium"
                onClick={() => void fetchNextPage()}
                _hover={{ textDecoration: 'underline' }}
              >
                Load more
              </Box>
            </Center>
          )}
        </VStack>
      )}
    </Box>
  );
};
