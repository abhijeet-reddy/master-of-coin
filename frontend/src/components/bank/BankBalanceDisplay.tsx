import { HStack, Text, Skeleton } from '@chakra-ui/react';
import type { BankBalanceResponse } from '@/types/bankProvider';

interface BankBalanceDisplayProps {
  balance: BankBalanceResponse | undefined;
  isLoading: boolean;
}

/**
 * Displays the current and available balance fetched from the bank provider.
 */
export const BankBalanceDisplay = ({ balance, isLoading }: BankBalanceDisplayProps) => {
  if (isLoading) {
    return <Skeleton height="20px" width="200px" />;
  }

  if (!balance) {
    return (
      <Text fontSize="sm" color="fg.muted">
        Balance unavailable
      </Text>
    );
  }

  return (
    <HStack gap={4}>
      <Text fontSize="sm">
        <Text as="span" color="fg.muted">
          Balance:
        </Text>{' '}
        <Text as="span" fontWeight="semibold">
          {balance.currency} {balance.current}
        </Text>
      </Text>
      {balance.available && (
        <Text fontSize="sm">
          <Text as="span" color="fg.muted">
            Available:
          </Text>{' '}
          <Text as="span" fontWeight="semibold">
            {balance.currency} {balance.available}
          </Text>
        </Text>
      )}
    </HStack>
  );
};
