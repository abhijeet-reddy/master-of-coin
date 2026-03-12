import { Badge, Card, HStack, IconButton, Text, VStack } from '@chakra-ui/react';
import {
  FaMoneyCheckAlt,
  FaPiggyBank,
  FaCreditCard,
  FaChartLine,
  FaWallet,
  FaGift,
  FaEdit,
  FaTrash,
} from 'react-icons/fa';
import { formatCurrency } from '@/utils/formatters';
import { AccountType } from '@/types';
import type { Account } from '@/types';

interface AccountCardProps {
  account: Account;
  onClick?: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

// Map account types to icons
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
    case AccountType.GIFT_CARD:
      return FaGift;
    default:
      return FaWallet;
  }
};

// Format account type for display
const formatAccountType = (type: AccountType): string => {
  if (!type) return 'Unknown';
  return type
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
};

// Get color scheme based on account type
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
    case AccountType.GIFT_CARD:
      return 'pink';
    default:
      return 'gray';
  }
};

export const AccountCard = ({ account, onClick, onEdit, onDelete }: AccountCardProps) => {
  const Icon = getAccountIcon(account.account_type);
  const colorScheme = getColorScheme(account.account_type);
  const balance = account.balance;

  return (
    <Card.Root
      cursor={onClick ? 'pointer' : undefined}
      onClick={onClick}
      _hover={onClick ? { shadow: 'md', borderColor: 'blue.200' } : undefined}
      transition="all 0.2s"
    >
      <Card.Body>
        <VStack align="stretch" gap={3}>
          {/* Header with icon and actions */}
          <HStack justify="space-between">
            <HStack gap={3}>
              <Text fontSize="2xl" color={`${colorScheme}.500`}>
                <Icon />
              </Text>
              <VStack align="start" gap={0}>
                <Text fontSize="lg" fontWeight="semibold">
                  {account.name}
                </Text>
                <Badge colorScheme={colorScheme} size="sm">
                  {formatAccountType(account.account_type)}
                </Badge>
              </VStack>
            </HStack>
            <HStack gap={1}>
              <IconButton
                aria-label="Edit account"
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
              >
                <FaEdit />
              </IconButton>
              <IconButton
                aria-label="Delete account"
                size="sm"
                variant="ghost"
                colorScheme="red"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <FaTrash />
              </IconButton>
            </HStack>
          </HStack>

          {/* Balance */}
          <VStack align="start" gap={0}>
            <Text fontSize="sm" color="fg.muted">
              Balance
            </Text>
            <Text fontSize="2xl" fontWeight="bold" color={balance >= 0 ? 'green.600' : 'red.600'}>
              {formatCurrency(balance, account.currency)}
            </Text>
          </VStack>

          {/* Notes preview */}
          {account.notes && (
            <Text fontSize="sm" color="fg.muted" lineClamp={2}>
              {account.notes}
            </Text>
          )}
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};
