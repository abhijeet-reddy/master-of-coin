import { Badge, Box, HStack, Icon, IconButton, Text, VStack } from '@chakra-ui/react';
import {
  FiShoppingCart,
  FiHome,
  FiCoffee,
  FiTrendingUp,
  FiUsers,
  FiTrash2,
  FiRepeat,
} from 'react-icons/fi';
import { HiOutlineDocumentDuplicate } from 'react-icons/hi';
import { FaEuroSign } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { AccountType } from '@/types';
import type { EnrichedTransaction, TransactionNavigationState } from '@/types';
import { formatCurrency, formatTime } from '@/utils/formatters';
import { SplitSyncStatus } from './SplitSyncStatus';

interface TransactionRowProps {
  transaction: EnrichedTransaction;
  onClick?: () => void;
  /** Called on Shift+Click to open the edit modal inline */
  onEdit?: (transaction: EnrichedTransaction) => void;
  onDelete?: (transaction: EnrichedTransaction) => void;
  /** Called to duplicate this transaction (open form pre-filled) */
  onDuplicate?: (transaction: EnrichedTransaction) => void;
  /** Navigation context passed to the transaction detail page for breadcrumbs */
  navigationState?: TransactionNavigationState;
}

// Map category icons to react-icons
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

export const TransactionRow = ({
  transaction,
  onClick,
  onEdit,
  onDelete,
  onDuplicate,
  navigationState,
}: TransactionRowProps) => {
  const navigate = useNavigate();
  const amount = parseFloat(transaction.amount);
  const isExpense = amount < 0;

  const CategoryIcon = getCategoryIcon(transaction.category?.icon);

  const handleClick = (e: React.MouseEvent) => {
    // Shift+Click → open edit modal (if onEdit provided)
    if (e.shiftKey && onEdit) {
      e.preventDefault();
      onEdit(transaction);
      return;
    }

    if (onClick) {
      onClick();
    } else {
      void navigate(`/transactions/${transaction.id}`, { state: navigationState });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      // Shift+Enter → edit
      if (e.shiftKey && onEdit) {
        onEdit(transaction);
        return;
      }
      if (onClick) {
        onClick();
      } else {
        void navigate(`/transactions/${transaction.id}`, { state: navigationState });
      }
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(transaction);
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDuplicate?.(transaction);
  };

  return (
    <Box
      p={4}
      bg="bg"
      borderRadius="md"
      borderWidth="1px"
      borderColor="border"
      cursor="pointer"
      _hover={{ bg: 'gray.50', borderColor: 'gray.300' }}
      onClick={handleClick}
      transition="all 0.2s"
      role="button"
      tabIndex={0}
      aria-label={`View transaction: ${transaction.title}`}
      onKeyDown={handleKeyDown}
    >
      <HStack justify="space-between" align="start" gap={3}>
        {/* Left side - Icon and details */}
        <HStack gap={3} flex={1}>
          {/* Category Icon */}
          <Box p={2} bg={transaction.category?.icon ? 'blue.50' : 'gray.50'} borderRadius="md">
            <Icon
              as={CategoryIcon}
              boxSize={5}
              color={transaction.category?.icon ? 'blue.500' : 'gray.500'}
            />
          </Box>

          {/* Transaction details */}
          <VStack align="start" gap={1} flex={1}>
            <Text fontWeight="semibold" fontSize="md">
              {transaction.title}
            </Text>

            <HStack gap={2} flexWrap="wrap">
              {/* Account badge (hidden for DEBT accounts) */}
              {transaction.account.type !== AccountType.DEBT && (
                <Badge colorScheme="gray" fontSize="xs">
                  {transaction.account.name}
                </Badge>
              )}

              {/* Transfer badge */}
              {transaction.transfer_info && (
                <Badge colorPalette="teal" fontSize="xs">
                  <HStack gap={1}>
                    <Icon as={FiRepeat} boxSize={3} />
                    <Text>
                      {isExpense
                        ? `→ ${transaction.transfer_info.linked_account_name}`
                        : `← ${transaction.transfer_info.linked_account_name}`}
                    </Text>
                  </HStack>
                </Badge>
              )}

              {/* Category badge */}
              {transaction.category && (
                <Badge colorScheme="blue" fontSize="xs">
                  {transaction.category.name}
                </Badge>
              )}

              {/* "Paid by" badge + split badge + sync status for debt transactions */}
              {transaction.debt_metadata && (
                <HStack gap={1} flexWrap="wrap">
                  <Badge colorScheme="orange" fontSize="xs">
                    Paid by {transaction.debt_metadata.payer_person_name}
                  </Badge>
                  <Badge colorScheme="purple" fontSize="xs">
                    <HStack gap={1}>
                      <Icon as={FiUsers} boxSize={3} />
                      <Text>Split</Text>
                    </HStack>
                  </Badge>
                  {transaction.splits?.map((split) => (
                    <SplitSyncStatus key={split.id} splitId={split.id} />
                  ))}
                </HStack>
              )}

              {/* Split indicator with sync status */}
              {transaction.splits &&
                transaction.splits.length > 0 &&
                !transaction.debt_metadata && (
                  <HStack gap={1} flexWrap="wrap">
                    <Badge colorScheme="purple" fontSize="xs">
                      <HStack gap={1}>
                        <Icon as={FiUsers} boxSize={3} />
                        <Text>Split</Text>
                      </HStack>
                    </Badge>
                    {transaction.splits.map((split) => (
                      <SplitSyncStatus key={split.id} splitId={split.id} />
                    ))}
                  </HStack>
                )}

              {/* Time on mobile */}
              <Text fontSize="xs" color="fg.muted" display={{ base: 'block', md: 'none' }}>
                {formatTime(transaction.date)}
              </Text>
            </HStack>
          </VStack>
        </HStack>

        {/* Right side - Amount and date */}
        <VStack align="end" gap={1} minW="100px">
          <Text fontWeight="bold" fontSize="lg" color={isExpense ? 'red.600' : 'green.600'}>
            {isExpense ? '-' : '+'}
            {formatCurrency(Math.abs(amount), transaction.account.currency)}
          </Text>

          {/* Time on desktop */}
          <Text fontSize="sm" color="fg.muted" display={{ base: 'none', md: 'block' }}>
            {formatTime(transaction.date)}
          </Text>
        </VStack>

        {/* Action buttons */}
        <HStack gap={0}>
          {/* Duplicate button — hidden for transfers */}
          {onDuplicate && !transaction.transfer_info && (
            <IconButton
              aria-label="Duplicate transaction"
              size="sm"
              variant="ghost"
              colorScheme="blue"
              onClick={handleDuplicate}
              _hover={{ bg: 'blue.50' }}
            >
              <Icon as={HiOutlineDocumentDuplicate} />
            </IconButton>
          )}

          {/* Delete button */}
          {onDelete && (
            <IconButton
              aria-label="Delete transaction"
              size="sm"
              variant="ghost"
              colorScheme="red"
              onClick={handleDelete}
              _hover={{ bg: 'red.50' }}
            >
              <Icon as={FiTrash2} />
            </IconButton>
          )}
        </HStack>
      </HStack>
    </Box>
  );
};
