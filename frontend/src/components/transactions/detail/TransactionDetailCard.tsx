import { Box, Button, Card, HStack, VStack, Text, Badge, Icon, Separator } from '@chakra-ui/react';
import {
  FiShoppingCart,
  FiHome,
  FiCoffee,
  FiTrendingUp,
  FiUsers,
  FiCreditCard,
  FiCalendar,
  FiTag,
  FiFileText,
  FiClock,
  FiRefreshCw,
} from 'react-icons/fi';
import { FaEuroSign } from 'react-icons/fa';
import type { EnrichedTransaction, Person } from '@/types';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/formatters';
import { SplitSyncStatus } from '@/components/transactions/SplitSyncStatus';

interface TransactionDetailCardProps {
  transaction: EnrichedTransaction;
  people: Person[];
  onSync?: () => void;
  isSyncing?: boolean;
}

const getCategoryIcon = (iconName?: string) => {
  const iconMap: Record<string, typeof FiShoppingCart> = {
    shopping: FiShoppingCart,
    home: FiHome,
    food: FiCoffee,
    income: FiTrendingUp,
    other: FaEuroSign,
  };
  return iconMap[iconName?.toLowerCase() || 'other'] || FaEuroSign;
};

export const TransactionDetailCard = ({
  transaction,
  people,
  onSync,
  isSyncing,
}: TransactionDetailCardProps) => {
  const amount = parseFloat(transaction.amount);
  const isExpense = amount < 0;
  const CategoryIcon = getCategoryIcon(transaction.category?.icon);

  const personMap = new Map(people.map((p) => [p.id, p]));

  return (
    <VStack gap={6} align="stretch">
      {/* Main Amount Card */}
      <Card.Root>
        <Card.Body>
          <VStack gap={4}>
            {/* Category Icon + Title */}
            <HStack gap={3}>
              <Box p={3} bg={transaction.category ? 'blue.50' : 'gray.100'} borderRadius="lg">
                <Icon
                  as={CategoryIcon}
                  boxSize={6}
                  color={transaction.category ? 'blue.500' : 'gray.500'}
                />
              </Box>
              <VStack align="start" gap={0}>
                <Text fontSize="xl" fontWeight="bold" color="fg">
                  {transaction.title}
                </Text>
                <Text fontSize="sm" color="fg.muted">
                  {formatDate(transaction.date, 'long')}
                </Text>
              </VStack>
            </HStack>

            {/* Amount */}
            <Box textAlign="center" py={2}>
              <Text fontSize="4xl" fontWeight="bold" color={isExpense ? 'red.600' : 'green.600'}>
                {isExpense ? '-' : '+'}
                {formatCurrency(Math.abs(amount), transaction.account.currency)}
              </Text>
              {transaction.user_share && (
                <Text fontSize="sm" color="fg.muted" mt={1}>
                  Your share:{' '}
                  {formatCurrency(
                    Math.abs(parseFloat(transaction.user_share)),
                    transaction.account.currency
                  )}
                </Text>
              )}
            </Box>
          </VStack>
        </Card.Body>
      </Card.Root>

      {/* Details Card */}
      <Card.Root>
        <Card.Header>
          <Text fontSize="lg" fontWeight="semibold" color="fg">
            Details
          </Text>
        </Card.Header>
        <Card.Body>
          <VStack gap={4} align="stretch">
            {/* Account */}
            <HStack justify="space-between">
              <HStack gap={2} color="fg.muted">
                <Icon as={FiCreditCard} />
                <Text fontSize="sm">Account</Text>
              </HStack>
              <Badge colorScheme="gray" fontSize="sm">
                {transaction.account.name}
              </Badge>
            </HStack>

            <Separator />

            {/* Category */}
            <HStack justify="space-between">
              <HStack gap={2} color="fg.muted">
                <Icon as={FiTag} />
                <Text fontSize="sm">Category</Text>
              </HStack>
              {transaction.category ? (
                <Badge colorScheme="blue" fontSize="sm">
                  {transaction.category.name}
                </Badge>
              ) : (
                <Text fontSize="sm" color="fg.muted">
                  Uncategorized
                </Text>
              )}
            </HStack>

            <Separator />

            {/* Date */}
            <HStack justify="space-between">
              <HStack gap={2} color="fg.muted">
                <Icon as={FiCalendar} />
                <Text fontSize="sm">Date</Text>
              </HStack>
              <Text fontSize="sm" fontWeight="medium">
                {formatDate(transaction.date, 'full')}
              </Text>
            </HStack>

            <Separator />

            {/* Currency */}
            <HStack justify="space-between">
              <HStack gap={2} color="fg.muted">
                <Icon as={FaEuroSign} />
                <Text fontSize="sm">Currency</Text>
              </HStack>
              <Text fontSize="sm" fontWeight="medium">
                {transaction.account.currency}
              </Text>
            </HStack>

            {/* Created / Updated */}
            <Separator />
            <HStack justify="space-between">
              <HStack gap={2} color="fg.muted">
                <Icon as={FiClock} />
                <Text fontSize="sm">Created</Text>
              </HStack>
              <Text fontSize="sm" color="fg.muted">
                {formatDateTime(transaction.created_at)}
              </Text>
            </HStack>

            {transaction.updated_at !== transaction.created_at && (
              <>
                <Separator />
                <HStack justify="space-between">
                  <HStack gap={2} color="fg.muted">
                    <Icon as={FiClock} />
                    <Text fontSize="sm">Updated</Text>
                  </HStack>
                  <Text fontSize="sm" color="fg.muted">
                    {formatDateTime(transaction.updated_at)}
                  </Text>
                </HStack>
              </>
            )}
          </VStack>
        </Card.Body>
      </Card.Root>

      {/* Notes Card */}
      {transaction.notes && (
        <Card.Root>
          <Card.Header>
            <HStack gap={2}>
              <Icon as={FiFileText} color="fg.muted" />
              <Text fontSize="lg" fontWeight="semibold" color="fg">
                Notes
              </Text>
            </HStack>
          </Card.Header>
          <Card.Body>
            <Text fontSize="sm" color="fg.muted" whiteSpace="pre-wrap">
              {transaction.notes}
            </Text>
          </Card.Body>
        </Card.Root>
      )}

      {/* Splits Card */}
      {transaction.splits && transaction.splits.length > 0 && (
        <Card.Root>
          <Card.Header>
            <HStack gap={2} justify="space-between" width="100%">
              <HStack gap={2}>
                <Icon as={FiUsers} color="fg.muted" />
                <Text fontSize="lg" fontWeight="semibold" color="fg">
                  Split Payment
                </Text>
              </HStack>
              <HStack gap={1}>
                {transaction.splits?.map((split) => (
                  <SplitSyncStatus key={split.id} splitId={split.id} showEmpty />
                ))}
                {onSync && (
                  <Button
                    size="xs"
                    variant="outline"
                    colorScheme="blue"
                    onClick={onSync}
                    loading={isSyncing}
                    aria-label="Sync with split provider"
                  >
                    <HStack gap={1}>
                      <FiRefreshCw />
                      <span>Sync</span>
                    </HStack>
                  </Button>
                )}
              </HStack>
            </HStack>
          </Card.Header>
          <Card.Body>
            <VStack gap={3} align="stretch">
              {/* Your share */}
              <HStack justify="space-between" p={3} bg="blue.50" borderRadius="md">
                <Text fontSize="sm" fontWeight="semibold">
                  You
                </Text>
                <Text fontSize="sm" fontWeight="bold" color="blue.600">
                  {formatCurrency(
                    Math.abs(parseFloat(transaction.user_share || transaction.amount)),
                    transaction.account.currency
                  )}
                </Text>
              </HStack>

              {/* Other people's shares */}
              {transaction.splits.map((split) => {
                const person = personMap.get(split.person_id);
                return (
                  <HStack
                    key={split.id}
                    justify="space-between"
                    p={3}
                    bg="gray.50"
                    borderRadius="md"
                  >
                    <Text fontSize="sm" fontWeight="medium">
                      {person?.name || split.person_name || 'Unknown'}
                    </Text>
                    <Text fontSize="sm" fontWeight="bold">
                      {formatCurrency(
                        Math.abs(parseFloat(split.amount)),
                        transaction.account.currency
                      )}
                    </Text>
                  </HStack>
                );
              })}

              {/* Total */}
              <Separator />
              <HStack justify="space-between" px={3}>
                <Text fontSize="sm" fontWeight="semibold">
                  Total
                </Text>
                <Text fontSize="sm" fontWeight="bold">
                  {formatCurrency(Math.abs(amount), transaction.account.currency)}
                </Text>
              </HStack>
            </VStack>
          </Card.Body>
        </Card.Root>
      )}
    </VStack>
  );
};
