import { Badge, Card, HStack, IconButton, Text, VStack } from '@chakra-ui/react';
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
import type { Account, AccountType } from '@/types';

interface AccountCardProps {
  account: Account;
  onEdit: () => void;
  onDelete: () => void;
}

// Map account types to icons
const getAccountIcon = (type: AccountType) => {
  switch (type) {
    case 'CHECKING':
      return FaMoneyCheckAlt;
    case 'SAVINGS':
      return FaPiggyBank;
    case 'CREDIT_CARD':
      return FaCreditCard;
    case 'INVESTMENT':
      return FaChartLine;
    case 'CASH':
      return FaWallet;
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
    case 'CHECKING':
      return 'blue';
    case 'SAVINGS':
      return 'green';
    case 'CREDIT_CARD':
      return 'purple';
    case 'INVESTMENT':
      return 'orange';
    case 'CASH':
      return 'gray';
    default:
      return 'gray';
  }
};

export const AccountCard = ({ account, onEdit, onDelete }: AccountCardProps) => {
  const Icon = getAccountIcon(account.account_type);
  const colorScheme = getColorScheme(account.account_type);
  const balance = account.balance;

  return (
    <Card.Root>
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
              <IconButton aria-label="Edit account" size="sm" variant="ghost" onClick={onEdit}>
                <FaEdit />
              </IconButton>
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
          <VStack align="start" gap={0}>
            <Text fontSize="sm" color="gray.600">
              Balance
            </Text>
            <Text fontSize="2xl" fontWeight="bold" color={balance >= 0 ? 'green.600' : 'red.600'}>
              {formatCurrency(balance, account.currency)}
            </Text>
          </VStack>

          {/* Notes preview */}
          {account.notes && (
            <Text fontSize="sm" color="gray.600" lineClamp={2}>
              {account.notes}
            </Text>
          )}
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};
