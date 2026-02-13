import { Badge, Box, HStack, Icon, IconButton, Text, VStack } from '@chakra-ui/react';
import { FiShoppingCart, FiHome, FiCoffee, FiTrendingUp, FiUsers, FiTrash2 } from 'react-icons/fi';
import { FaEuroSign } from 'react-icons/fa';
import type { EnrichedTransaction } from '@/types';
import { formatCurrency, formatTime } from '@/utils/formatters';
import { SplitSyncStatus } from './SplitSyncStatus';

interface TransactionRowProps {
  transaction: EnrichedTransaction;
  onClick: () => void;
  onDelete?: (transaction: EnrichedTransaction) => void;
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

export const TransactionRow = ({ transaction, onClick, onDelete }: TransactionRowProps) => {
  const amount = parseFloat(transaction.amount);
  const isExpense = amount < 0;

  const CategoryIcon = getCategoryIcon(transaction.category?.icon);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(transaction);
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
      onClick={onClick}
      transition="all 0.2s"
      role="button"
      tabIndex={0}
      aria-label={`View transaction: ${transaction.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
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

              {/* Split indicator with sync status */}
              {transaction.splits && transaction.splits.length > 0 && (
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
    </Box>
  );
};
