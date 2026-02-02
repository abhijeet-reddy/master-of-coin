import { Box, Card, HStack, VStack, Text, Icon, Badge } from '@chakra-ui/react';
import { FiCreditCard, FiTrendingUp, FiHome, FiShoppingBag } from 'react-icons/fi';
import { FaEuroSign } from 'react-icons/fa';
import type { Account, AccountType } from '@/types/models';
import { EmptyState } from '@/components/common';
import { formatCurrency } from '../../utils/formatters/currency';

interface AccountSummaryProps {
  accounts: Account[];
}

const getAccountIcon = (type: AccountType) => {
  switch (type) {
    case 'CHECKING':
    case 'SAVINGS':
      return FaEuroSign;
    case 'CREDIT_CARD':
      return FiCreditCard;
    case 'INVESTMENT':
      return FiTrendingUp;
    case 'LOAN':
      return FiHome;
    case 'CASH':
    case 'OTHER':
    default:
      return FiShoppingBag;
  }
};

const getAccountColor = (type: AccountType): string => {
  switch (type) {
    case 'CHECKING':
      return 'blue.500';
    case 'SAVINGS':
      return 'green.500';
    case 'CREDIT_CARD':
      return 'purple.500';
    case 'INVESTMENT':
      return 'orange.500';
    case 'LOAN':
      return 'red.500';
    case 'CASH':
      return 'yellow.500';
    case 'OTHER':
    default:
      return 'gray.500';
  }
};

const formatAccountType = (type: AccountType): string => {
  return type
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
};

export const AccountSummary = ({ accounts }: AccountSummaryProps) => {
  if (accounts.length === 0) {
    return (
      <Box>
        <Text fontSize="lg" fontWeight="semibold" mb={4} color="fg">
          Accounts
        </Text>
        <EmptyState
          title="No accounts yet"
          description="Create your first account to start tracking your finances"
        />
      </Box>
    );
  }

  return (
    <Box>
      <Text fontSize="lg" fontWeight="semibold" mb={4} color="fg">
        Accounts
      </Text>
      <HStack
        gap={4}
        overflowX="auto"
        pb={2}
        css={{
          '&::-webkit-scrollbar': {
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#f1f1f1',
            borderRadius: '10px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#888',
            borderRadius: '10px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: '#555',
          },
        }}
      >
        {accounts.map((account) => {
          const IconComponent = getAccountIcon(account.account_type);
          const iconColor = getAccountColor(account.account_type);
          const balance = account.balance;
          const isNegative = balance < 0;

          return (
            <Card.Root
              key={account.id}
              minW="280px"
              shadow="sm"
              _hover={{ shadow: 'md', transform: 'translateY(-2px)' }}
              transition="all 0.2s"
              cursor="pointer"
            >
              <Card.Body p={4}>
                <VStack alignItems="flex-start" gap={3}>
                  {/* Icon and Type */}
                  <HStack justifyContent="space-between" width="100%">
                    <Box
                      bg={`${iconColor.split('.')[0]}.50`}
                      p={2}
                      borderRadius="md"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Icon fontSize="xl" color={iconColor}>
                        <IconComponent />
                      </Icon>
                    </Box>
                    <Badge
                      colorPalette={iconColor.split('.')[0]}
                      fontSize="xs"
                      px={2}
                      py={1}
                      borderRadius="full"
                    >
                      {formatAccountType(account.account_type)}
                    </Badge>
                  </HStack>

                  {/* Account Name */}
                  <Box width="100%">
                    <Text
                      fontSize="md"
                      fontWeight="semibold"
                      color="fg"
                      title={account.name}
                      css={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {account.name}
                    </Text>
                  </Box>

                  {/* Balance */}
                  <Box width="100%">
                    <Text fontSize="xs" color="fg.muted" mb={1}>
                      Balance
                    </Text>
                    <Text
                      fontSize="2xl"
                      fontWeight="bold"
                      color={isNegative ? 'red.600' : 'gray.800'}
                    >
                      {formatCurrency(account.balance)}
                    </Text>
                  </Box>
                </VStack>
              </Card.Body>
            </Card.Root>
          );
        })}
      </HStack>
    </Box>
  );
};
