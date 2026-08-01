import { useState, useCallback } from 'react';
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
  FiRepeat,
  FiCopy,
  FiCheck,
  FiArrowRight,
  FiArrowLeft,
  FiArrowUp,
  FiArrowDown,
} from 'react-icons/fi';
import { FaEuroSign } from 'react-icons/fa';
import type { EnrichedTransaction, Person } from '@/types';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/formatters';
import { calculateUserShare } from '@/utils/splitCalculation';
import { SplitSyncStatus } from '@/components/transactions/SplitSyncStatus';
import { toaster } from '@/components/ui/toaster';

interface TransactionDetailCardProps {
  transaction: EnrichedTransaction;
  people: Person[];
  onSync?: () => void;
  isSyncing?: boolean;
  /** When true (soft-deleted), the amount is struck through. */
  isDeleted?: boolean;
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
  isDeleted = false,
}: TransactionDetailCardProps) => {
  const [copied, setCopied] = useState(false);
  const amount = parseFloat(transaction.amount);
  const isExpense = amount < 0;
  const isDebtTransaction = !!transaction.debt_metadata;
  const CategoryIcon = getCategoryIcon(transaction.category?.icon);

  // Determine amount color: orange for debt transactions (someone else paid), red/green otherwise
  const amountColor = isDebtTransaction ? 'orange.600' : isExpense ? 'red.600' : 'green.600';

  // Compute debt effect from splits (how this transaction changed the debt relationship)
  const debtEffect =
    transaction.splits && transaction.splits.length > 0
      ? transaction.splits.reduce((sum, s) => sum + parseFloat(s.amount), 0)
      : null;

  const personMap = new Map(people.map((p) => [p.id, p]));

  // Derived: user's share of a split transaction (total minus other people's splits)
  const userShare = transaction.splits?.length
    ? calculateUserShare(
        amount,
        transaction.splits.map((s) => s.amount)
      )
    : Math.abs(amount);

  const handleCopyTransferId = useCallback((transferId: string) => {
    void navigator.clipboard.writeText(transferId).then(() => {
      setCopied(true);
      toaster.create({ title: 'Transfer ID copied', type: 'info' });
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

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
              <Text
                fontSize="4xl"
                fontWeight="bold"
                color={amountColor}
                textDecoration={isDeleted ? 'line-through' : undefined}
              >
                {isExpense ? '-' : '+'}
                {formatCurrency(Math.abs(amount), transaction.account.currency)}
              </Text>
              {/* Debt effect indicator */}
              {debtEffect !== null && debtEffect !== 0 && (
                <HStack gap={1} justify="center" mt={1}>
                  <Icon
                    as={debtEffect < 0 ? FiArrowUp : FiArrowDown}
                    boxSize={3.5}
                    color={debtEffect < 0 ? 'red.500' : 'green.500'}
                  />
                  <Text fontSize="sm" color={debtEffect < 0 ? 'red.600' : 'green.600'}>
                    Debt {formatCurrency(Math.abs(debtEffect), transaction.account.currency)}
                  </Text>
                </HStack>
              )}
              {transaction.splits &&
                transaction.splits.length > 0 &&
                !transaction.debt_metadata && (
                  <Text fontSize="sm" color="fg.muted" mt={1}>
                    Your share: {formatCurrency(userShare, transaction.account.currency)}
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
            {/* Account or "Paid by" */}
            {transaction.debt_metadata ? (
              <HStack justify="space-between">
                <HStack gap={2} color="fg.muted">
                  <Icon as={FiUsers} />
                  <Text fontSize="sm">Paid by</Text>
                </HStack>
                <Badge colorScheme="orange" fontSize="sm">
                  {transaction.debt_metadata.payer_person_name}
                </Badge>
              </HStack>
            ) : (
              <HStack justify="space-between">
                <HStack gap={2} color="fg.muted">
                  <Icon as={FiCreditCard} />
                  <Text fontSize="sm">Account</Text>
                </HStack>
                <Badge colorScheme="gray" fontSize="sm">
                  {transaction.account.name}
                </Badge>
              </HStack>
            )}

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

      {/* Transfer Details Card — shown only for transfer transactions */}
      {transaction.transfer_info && (
        <Card.Root>
          <Card.Header>
            <HStack gap={2}>
              <Badge colorPalette="teal" fontSize="sm">
                <HStack gap={1}>
                  <Icon as={FiRepeat} boxSize={3} />
                  <Text>Transfer</Text>
                </HStack>
              </Badge>
              <Text fontSize="lg" fontWeight="semibold" color="fg">
                Transfer Details
              </Text>
            </HStack>
          </Card.Header>
          <Card.Body>
            <VStack gap={3} align="stretch">
              {/* Transfer ID (copiable) */}
              <HStack justify="space-between">
                <Text fontSize="sm" color="fg.muted">
                  Transfer ID
                </Text>
                <HStack
                  gap={1}
                  cursor="pointer"
                  onClick={() => handleCopyTransferId(transaction.transfer_info!.transfer_id)}
                  _hover={{ color: 'blue.500' }}
                  color="fg.muted"
                  title="Click to copy"
                >
                  <Text fontSize="xs" fontFamily="mono">
                    {transaction.transfer_info.transfer_id}
                  </Text>
                  <Icon as={copied ? FiCheck : FiCopy} boxSize={3} />
                </HStack>
              </HStack>

              <Separator />

              {/* Direction + Linked Account (combined) */}
              <HStack justify="space-between">
                <HStack gap={2} color="fg.muted">
                  <Icon as={isExpense ? FiArrowRight : FiArrowLeft} />
                  <Text fontSize="sm">{isExpense ? 'Transferred to' : 'Received from'}</Text>
                </HStack>
                <Badge colorPalette="gray" fontSize="sm">
                  {transaction.transfer_info.linked_account_name} ({transaction.account.currency})
                </Badge>
              </HStack>
            </VStack>
          </Card.Body>
        </Card.Root>
      )}

      {/* Full Expense Breakdown — shown for debt transactions with expense_participants */}
      {transaction.debt_metadata?.expense_participants &&
        transaction.debt_metadata.expense_participants.length > 0 && (
          <Card.Root>
            <Card.Header>
              <HStack gap={2} justify="space-between" width="100%">
                <HStack gap={2}>
                  <Icon as={FiUsers} color="fg.muted" />
                  <Text fontSize="lg" fontWeight="semibold" color="fg">
                    Full Expense
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
                      aria-label="Sync with Splitwise"
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
                {/* Each participant's share */}
                {transaction.debt_metadata.expense_participants.map((participant, idx) => {
                  const isPayer = parseFloat(participant.paid_share) > 0;
                  return (
                    <HStack
                      key={idx}
                      justify="space-between"
                      p={3}
                      bg={isPayer ? 'orange.50' : 'gray.50'}
                      borderRadius="md"
                    >
                      <HStack gap={2}>
                        <Text fontSize="sm" fontWeight={isPayer ? 'semibold' : 'medium'}>
                          {participant.name || 'Unknown'}
                        </Text>
                        {isPayer && (
                          <Badge colorScheme="orange" fontSize="xs">
                            Paid
                          </Badge>
                        )}
                      </HStack>
                      <Text fontSize="sm" fontWeight="bold">
                        {formatCurrency(
                          parseFloat(participant.owed_share),
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
                    {formatCurrency(
                      parseFloat(transaction.debt_metadata.total_cost),
                      transaction.account.currency
                    )}
                  </Text>
                </HStack>
              </VStack>
            </Card.Body>
          </Card.Root>
        )}

      {/* Debt Sync Card — shown for debt transactions WITHOUT expense_participants */}
      {transaction.debt_metadata &&
        !transaction.debt_metadata.expense_participants?.length &&
        transaction.splits &&
        transaction.splits.length > 0 && (
          <Card.Root>
            <Card.Header>
              <HStack gap={2} justify="space-between" width="100%">
                <HStack gap={2}>
                  <Icon as={FiRefreshCw} color="fg.muted" />
                  <Text fontSize="lg" fontWeight="semibold" color="fg">
                    Splitwise Sync
                  </Text>
                </HStack>
                <HStack gap={1}>
                  {transaction.splits.map((split) => (
                    <SplitSyncStatus key={split.id} splitId={split.id} showEmpty />
                  ))}
                  {onSync && (
                    <Button
                      size="xs"
                      variant="outline"
                      colorScheme="blue"
                      onClick={onSync}
                      loading={isSyncing}
                      aria-label="Sync with Splitwise"
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
              <Text fontSize="sm" color="fg.muted">
                Sync this expense with Splitwise. The expense will be created with{' '}
                <Text as="span" fontWeight="semibold">
                  {transaction.debt_metadata.payer_person_name}
                </Text>{' '}
                as the payer.
              </Text>
            </Card.Body>
          </Card.Root>
        )}

      {/* Splits Card (hidden for debt transactions — split is system-managed) */}
      {transaction.splits && transaction.splits.length > 0 && !transaction.debt_metadata && (
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
                  {formatCurrency(userShare, transaction.account.currency)}
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
