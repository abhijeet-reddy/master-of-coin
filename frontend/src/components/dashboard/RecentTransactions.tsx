import { Box, Card, HStack, VStack, Text, Icon, Badge } from '@chakra-ui/react';
import { FiArrowRight, FiShoppingBag } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import type { EnrichedTransaction } from '@/types/models';
import { EmptyState } from '@/components/common';
import { format } from 'date-fns';

interface RecentTransactionsProps {
  transactions: EnrichedTransaction[];
}

export const RecentTransactions = ({ transactions }: RecentTransactionsProps) => {
  const formatCurrency = (value: string) => {
    const num = parseFloat(value);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  if (transactions.length === 0) {
    return (
      <Card.Root>
        <Card.Header>
          <Text fontSize="lg" fontWeight="semibold" color="gray.700">
            Recent Transactions
          </Text>
        </Card.Header>
        <Card.Body>
          <EmptyState
            title="No transactions yet"
            description="Your recent transactions will appear here"
          />
        </Card.Body>
      </Card.Root>
    );
  }

  return (
    <Card.Root>
      <Card.Header>
        <HStack justifyContent="space-between">
          <Text fontSize="lg" fontWeight="semibold" color="gray.700">
            Recent Transactions
          </Text>
          <Link to="/transactions">
            <HStack
              gap={1}
              color="brand.600"
              fontSize="sm"
              fontWeight="medium"
              _hover={{ color: 'brand.700' }}
              cursor="pointer"
            >
              <Text>View All</Text>
              <Icon fontSize="sm">
                <FiArrowRight />
              </Icon>
            </HStack>
          </Link>
        </HStack>
      </Card.Header>
      <Card.Body p={0}>
        <VStack gap={0} divideY="1px" divideColor="gray.200">
          {transactions.map((transaction) => {
            const amount = parseFloat(transaction.amount);
            const isNegative = amount < 0;

            return (
              <Link
                key={transaction.id}
                to={`/transactions/${transaction.id}`}
                style={{ width: '100%' }}
              >
                <HStack
                  p={4}
                  justifyContent="space-between"
                  _hover={{ bg: 'gray.50' }}
                  transition="background 0.2s"
                  cursor="pointer"
                  width="100%"
                >
                  {/* Left side: Icon and details */}
                  <HStack gap={3} flex="1" minW={0}>
                    {/* Category icon */}
                    <Box
                      bg={transaction.category ? 'brand.50' : 'gray.100'}
                      p={2}
                      borderRadius="md"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      flexShrink={0}
                    >
                      <Icon fontSize="lg" color={transaction.category ? 'brand.600' : 'gray.600'}>
                        <FiShoppingBag />
                      </Icon>
                    </Box>

                    {/* Transaction details */}
                    <VStack alignItems="flex-start" gap={0} flex="1" minW={0}>
                      <Text
                        fontSize="sm"
                        fontWeight="semibold"
                        color="gray.700"
                        css={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        width="100%"
                      >
                        {transaction.title}
                      </Text>
                      <HStack gap={2} fontSize="xs" color="gray.500">
                        <Text>{transaction.account.name}</Text>
                        {transaction.category?.name && (
                          <>
                            <Text>•</Text>
                            <Badge
                              colorPalette="gray"
                              fontSize="xs"
                              px={2}
                              py={0.5}
                              borderRadius="full"
                            >
                              {transaction.category.name}
                            </Badge>
                          </>
                        )}
                      </HStack>
                    </VStack>
                  </HStack>

                  {/* Right side: Amount and date */}
                  <VStack alignItems="flex-end" gap={0} flexShrink={0}>
                    <Text
                      fontSize="md"
                      fontWeight="bold"
                      color={isNegative ? 'red.600' : 'green.600'}
                    >
                      {isNegative ? '-' : '+'}
                      {formatCurrency(Math.abs(amount).toString())}
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      {formatDate(transaction.date)}
                    </Text>
                  </VStack>
                </HStack>
              </Link>
            );
          })}
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};
