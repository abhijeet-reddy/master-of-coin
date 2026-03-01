import { Badge, Box, Button, Card, HStack, IconButton, Text, VStack } from '@chakra-ui/react';
import {
  FaMoneyCheckAlt,
  FaPiggyBank,
  FaCreditCard,
  FaChartLine,
  FaWallet,
  FaEdit,
  FaTrash,
} from 'react-icons/fa';
import { formatCurrency } from '@/utils/formatters';
import { AccountType } from '@/types';
import type { Account } from '@/types';

interface AccountInfoCardProps {
  account: Account;
  onEdit: () => void;
  onDelete: () => void;
}

/** Map account types to icons */
const getAccountIcon = (type: AccountType) => {
  switch (type) {
    case AccountType.CHECKING:
      return FaMoneyCheckAlt;
    case AccountType.SAVINGS:
      return FaPiggyBank;
    case AccountType.CREDIT_CARD:
      return FaCreditCard;
    case AccountType.INVESTMENT:
      return FaChartLine;
    case AccountType.CASH:
      return FaWallet;
    default:
      return FaWallet;
  }
};

/** Format account type for display */
const formatAccountType = (type: AccountType): string => {
  if (!type) return 'Unknown';
  return type
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
};

/** Get color scheme based on account type */
const getColorScheme = (type: AccountType): string => {
  switch (type) {
    case AccountType.CHECKING:
      return 'blue';
    case AccountType.SAVINGS:
      return 'green';
    case AccountType.CREDIT_CARD:
      return 'purple';
    case AccountType.INVESTMENT:
      return 'orange';
    case AccountType.CASH:
      return 'gray';
    default:
      return 'gray';
  }
};

export const AccountInfoCard = ({ account, onEdit, onDelete }: AccountInfoCardProps) => {
  const Icon = getAccountIcon(account.account_type);
  const colorScheme = getColorScheme(account.account_type);
  const balance = account.balance;

  return (
    <Card.Root variant="elevated" mb={6}>
      <Card.Body p={6}>
        <VStack align="stretch" gap={4}>
          {/* Header with icon, name, and actions */}
          <HStack justify="space-between" align="flex-start">
            <HStack gap={4}>
              <Box
                p={3}
                borderRadius="lg"
                bg={`${colorScheme}.50`}
                color={`${colorScheme}.500`}
                fontSize="2xl"
              >
                <Icon />
              </Box>
              <VStack align="start" gap={1}>
                <Text fontSize="xl" fontWeight="bold">
                  {account.name}
                </Text>
                <Badge colorScheme={colorScheme} size="sm">
                  {formatAccountType(account.account_type)}
                </Badge>
              </VStack>
            </HStack>
            <HStack gap={1}>
              <Button size="sm" variant="outline" onClick={onEdit}>
                <HStack gap={1}>
                  <FaEdit />
                  <Text display={{ base: 'none', md: 'block' }}>Edit</Text>
                </HStack>
              </Button>
              <IconButton
                aria-label="Delete account"
                size="sm"
                variant="ghost"
                colorScheme="red"
                onClick={onDelete}
              >
                <FaTrash />
              </IconButton>
            </HStack>
          </HStack>

          {/* Balance */}
          <Box>
            <Text fontSize="sm" color="fg.muted" mb={1}>
              Current Balance
            </Text>
            <Text fontSize="3xl" fontWeight="bold" color={balance >= 0 ? 'green.600' : 'red.600'}>
              {formatCurrency(balance, account.currency)}
            </Text>
          </Box>

          {/* Notes */}
          {account.notes && (
            <Box>
              <Text fontSize="sm" color="fg.muted" mb={1}>
                Notes
              </Text>
              <Text fontSize="sm">{account.notes}</Text>
            </Box>
          )}
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};
