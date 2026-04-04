import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  HStack,
  IconButton,
  Input,
  Text,
  VStack,
} from '@chakra-ui/react';
import {
  FaMoneyCheckAlt,
  FaPiggyBank,
  FaCreditCard,
  FaChartLine,
  FaWallet,
  FaGift,
  FaEdit,
  FaTrash,
  FaSync,
  FaExternalLinkAlt,
} from 'react-icons/fa';
import { MdEdit } from 'react-icons/md';
import { formatCurrency } from '@/utils/formatters';
import { AccountType } from '@/types';
import type { Account } from '@/types';

interface AccountInfoCardProps {
  account: Account;
  onEdit: () => void;
  onDelete: () => void;
  /** Show the sync button */
  showSyncButton?: boolean;
  /** Label for the sync button (defaults to "Sync Portfolio") */
  syncLabel?: string;
  /** Handler for the sync button */
  onSync?: () => void;
  /** Whether a sync is currently in progress */
  isSyncing?: boolean;
  /** Whether the last sync failed */
  syncFailed?: boolean;
  /** Error message from the failed sync */
  syncError?: string;
  /** Job ID of the failed sync (for linking to job detail) */
  syncJobId?: string | null;
  /** Whether this is an investment account (enables Update Value) */
  isInvestment?: boolean;
  /** Handler for updating the investment value */
  onUpdateValue?: (newBalance: number) => void;
  /** Whether a value update is in progress */
  isUpdatingValue?: boolean;
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
    case AccountType.GIFT_CARD:
      return FaGift;
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
    case AccountType.GIFT_CARD:
      return 'pink';
    default:
      return 'gray';
  }
};

export const AccountInfoCard = ({
  account,
  onEdit,
  onDelete,
  showSyncButton,
  syncLabel,
  onSync,
  isSyncing,
  syncFailed,
  syncError,
  syncJobId,
  isInvestment,
  onUpdateValue,
  isUpdatingValue,
}: AccountInfoCardProps) => {
  const navigate = useNavigate();
  const Icon = getAccountIcon(account.account_type);
  const colorScheme = getColorScheme(account.account_type);
  const balance = account.balance;

  // Inline edit state for investment value update
  const [isEditingValue, setIsEditingValue] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditingValue && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingValue]);

  // Exit edit mode when update completes
  useEffect(() => {
    if (!isUpdatingValue && isEditingValue) {
      setIsEditingValue(false);
    }
  }, [isUpdatingValue]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStartEdit = () => {
    setEditValue(balance.toString());
    setIsEditingValue(true);
  };

  const handleCancelEdit = () => {
    setIsEditingValue(false);
    setEditValue('');
  };

  const handleSubmitValue = () => {
    const newBalance = parseFloat(editValue);
    if (isNaN(newBalance)) return;
    onUpdateValue?.(newBalance);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmitValue();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <>
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
              <HStack gap={2}>
                {showSyncButton && (
                  <Button
                    size="sm"
                    colorPalette="blue"
                    onClick={onSync}
                    loading={isSyncing}
                    disabled={isSyncing}
                  >
                    <FaSync />
                    <Text display={{ base: 'none', md: 'block' }}>
                      {syncLabel ?? 'Sync Portfolio'}
                    </Text>
                  </Button>
                )}
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
                {isInvestment ? 'Portfolio Value' : 'Current Balance'}
              </Text>
              {isEditingValue ? (
                <HStack gap={2}>
                  <Input
                    ref={inputRef}
                    type="number"
                    step="0.01"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    size="lg"
                    fontWeight="bold"
                    width="200px"
                  />
                  <Button
                    size="sm"
                    colorPalette="green"
                    onClick={handleSubmitValue}
                    loading={isUpdatingValue}
                    disabled={isUpdatingValue || editValue === '' || isNaN(parseFloat(editValue))}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelEdit}
                    disabled={isUpdatingValue}
                  >
                    Cancel
                  </Button>
                </HStack>
              ) : (
                <HStack gap={2} align="baseline">
                  <Text
                    fontSize="3xl"
                    fontWeight="bold"
                    color={balance >= 0 ? 'green.600' : 'red.600'}
                  >
                    {formatCurrency(balance, account.currency)}
                  </Text>
                  {isInvestment && onUpdateValue && (
                    <IconButton
                      aria-label="Update value"
                      size="xs"
                      variant="ghost"
                      onClick={handleStartEdit}
                    >
                      <MdEdit />
                    </IconButton>
                  )}
                </HStack>
              )}
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

      {/* Sync failure alert */}
      {syncFailed && (
        <Alert.Root status="error" mb={6} borderRadius="md">
          <Alert.Indicator />
          <Box flex="1">
            <Alert.Title>Portfolio sync failed</Alert.Title>
            <Alert.Description>
              {syncError ?? 'An unknown error occurred during portfolio sync.'}
            </Alert.Description>
          </Box>
          {syncJobId && (
            <Button
              size="sm"
              variant="outline"
              colorPalette="red"
              onClick={() => void navigate(`/jobs/portfolio-sync/${syncJobId}`)}
            >
              <FaExternalLinkAlt />
              View Job Details
            </Button>
          )}
        </Alert.Root>
      )}
    </>
  );
};
