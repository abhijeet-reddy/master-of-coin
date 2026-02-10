import { useEffect, useRef } from 'react';
import { Box, Heading, Skeleton, Stack, Text, VStack, Spinner, Center } from '@chakra-ui/react';
import { TransactionRow } from './TransactionRow';
import { EmptyState } from '@/components/common/EmptyState';
import { useTransactionCurrencyConverter } from '@/hooks/usecase/useTransactionCurrencyConverter';
import type { EnrichedTransaction } from '@/types';
import { formatCurrency, formatDate } from '@/utils/formatters';

interface TransactionListProps {
  transactions: EnrichedTransaction[];
  isLoading?: boolean;
  onTransactionClick: (transaction: EnrichedTransaction) => void;
  onTransactionDelete?: (transaction: EnrichedTransaction) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isFetchingMore?: boolean;
}

interface GroupedTransactions {
  [date: string]: EnrichedTransaction[];
}

export const TransactionList = ({
  transactions,
  isLoading,
  onTransactionClick,
  onTransactionDelete,
  onLoadMore,
  hasMore,
  isFetchingMore,
}: TransactionListProps) => {
  const { convertAmount, isLoading: isExchangeRatesLoading } =
    useTransactionCurrencyConverter(transactions);

  // Ref for the sentinel element at the bottom of the list
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    if (!sentinelRef.current || !onLoadMore || !hasMore || isFetchingMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        // When the sentinel element is visible, load more transactions
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      {
        // Trigger when sentinel is 100px from viewport
        rootMargin: '100px',
      }
    );

    observer.observe(sentinelRef.current);

    return () => {
      observer.disconnect();
    };
  }, [onLoadMore, hasMore, isFetchingMore]);

  // Group transactions by date
  const groupedTransactions = transactions.reduce<GroupedTransactions>((acc, transaction) => {
    const date = formatDate(transaction.date, 'long');

    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(transaction);
    return acc;
  }, {});

  // Calculate daily totals with currency conversion
  const getDailyTotal = (transactions: EnrichedTransaction[]) => {
    if (isExchangeRatesLoading) {
      return 0;
    }
    return transactions.reduce((sum, t) => {
      const amount = parseFloat(t.amount);
      const converted = convertAmount(Math.abs(amount), t.account.currency);
      return sum + (amount < 0 ? -converted : converted);
    }, 0);
  };

  // Loading skeleton
  if (isLoading || isExchangeRatesLoading) {
    return (
      <Stack gap={4}>
        {[1, 2, 3].map((i) => (
          <Box key={i}>
            <Skeleton height="20px" width="200px" mb={2} />
            <Stack gap={2}>
              <Skeleton height="80px" borderRadius="md" />
              <Skeleton height="80px" borderRadius="md" />
            </Stack>
          </Box>
        ))}
      </Stack>
    );
  }

  // Empty state
  if (transactions.length === 0) {
    return (
      <EmptyState
        title="No transactions found"
        description="Start by adding your first transaction"
      />
    );
  }

  return (
    <VStack align="stretch" gap={6}>
      {Object.entries(groupedTransactions).map(([date, dayTransactions]) => {
        const dailyTotal = getDailyTotal(dayTransactions);
        const isExpense = dailyTotal < 0;

        return (
          <Box key={date}>
            {/* Date header with daily total */}
            <Box
              mb={3}
              pb={2}
              borderBottomWidth="2px"
              borderBottomColor="gray.200"
              display="flex"
              justifyContent="space-between"
              alignItems="center"
            >
              <Heading size="sm" color="fg">
                {date}
              </Heading>
              <Text fontSize="sm" fontWeight="semibold" color={isExpense ? 'red.600' : 'green.600'}>
                {isExpense ? '-' : '+'}
                {formatCurrency(Math.abs(dailyTotal))}
              </Text>
            </Box>

            {/* Transaction rows */}
            <Stack gap={2}>
              {dayTransactions.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  onClick={() => onTransactionClick(transaction)}
                  onDelete={onTransactionDelete}
                />
              ))}
            </Stack>
          </Box>
        );
      })}

      {/* Loading more indicator */}
      {isFetchingMore && (
        <Center py={4}>
          <Spinner size="md" color="blue.500" />
        </Center>
      )}

      {/* Sentinel element for intersection observer */}
      {hasMore && !isFetchingMore && <Box ref={sentinelRef} h="20px" />}
    </VStack>
  );
};
