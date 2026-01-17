import { Badge, Box, HStack, Icon, Text, VStack } from '@chakra-ui/react';
import {
  FiShoppingCart,
  FiHome,
  FiCoffee,
  FiTrendingUp,
  FiDollarSign,
  FiUsers,
} from 'react-icons/fi';
import type { EnrichedTransaction } from '@/types';
import { formatCurrency, formatDate } from '@/utils/formatters';

interface TransactionRowProps {
  transaction: EnrichedTransaction;
  onClick: () => void;
}

// Map category icons to react-icons
const getCategoryIcon = (iconName?: string) => {
  const iconMap: Record<string, typeof FiShoppingCart> = {
    shopping: FiShoppingCart,
    home: FiHome,
    food: FiCoffee,
    income: FiTrendingUp,
    other: FiDollarSign,
  };

  return iconMap[iconName?.toLowerCase() || 'other'] || FiDollarSign;
};

export const TransactionRow = ({ transaction, onClick }: TransactionRowProps) => {
  const amount = parseFloat(transaction.amount);
  const isExpense = amount < 0;
  const displayAmount = Math.abs(amount);

  const CategoryIcon = getCategoryIcon(transaction.category?.icon);

  return (
    <Box
      p={4}
      bg="white"
      borderRadius="md"
      borderWidth="1px"
      borderColor="gray.200"
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
      <HStack justify="space-between" align="start">
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

              {/* Split indicator */}
              {transaction.splits && transaction.splits.length > 0 && (
                <Badge colorScheme="purple" fontSize="xs">
                  <HStack gap={1}>
                    <Icon as={FiUsers} boxSize={3} />
                    <Text>Split</Text>
                  </HStack>
                </Badge>
              )}

              {/* Date on mobile */}
              <Text fontSize="xs" color="gray.500" display={{ base: 'block', md: 'none' }}>
                {formatDate(transaction.date)}
              </Text>
            </HStack>
          </VStack>
        </HStack>

        {/* Right side - Amount and date */}
        <VStack align="end" gap={1} minW="100px">
          <Text fontWeight="bold" fontSize="lg" color={isExpense ? 'red.600' : 'green.600'}>
            {isExpense ? '-' : '+'}
            {formatCurrency(displayAmount)}
          </Text>

          {/* Date on desktop */}
          <Text fontSize="sm" color="gray.500" display={{ base: 'none', md: 'block' }}>
            {formatDate(transaction.date)}
          </Text>
        </VStack>
      </HStack>
    </Box>
  );
};
