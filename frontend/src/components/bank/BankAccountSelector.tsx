import { Box, VStack, HStack, Text, Button, Spinner } from '@chakra-ui/react';
import type { ExternalBankAccount } from '@/types/bankProvider';

interface BankAccountSelectorProps {
  accounts: ExternalBankAccount[];
  isLoading: boolean;
  isLinking: boolean;
  onSelect: (accountId: string) => void;
  onCancel: () => void;
}

/**
 * Displays a list of external bank accounts for the user to select which one
 * to link to their Master of Coin account.
 */
export const BankAccountSelector = ({
  accounts,
  isLoading,
  isLinking,
  onSelect,
  onCancel,
}: BankAccountSelectorProps) => {
  if (isLoading) {
    return (
      <Box p={3} borderWidth="1px" borderRadius="md">
        <VStack align="stretch" gap={2}>
          <Text fontSize="sm" fontWeight="medium">
            Loading bank accounts...
          </Text>
          <Spinner size="sm" />
        </VStack>
      </Box>
    );
  }

  if (accounts.length === 0) {
    return (
      <Box p={3} borderWidth="1px" borderRadius="md">
        <VStack align="stretch" gap={2}>
          <Text fontSize="sm" color="fg.muted">
            No bank accounts found. Please try reconnecting.
          </Text>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </VStack>
      </Box>
    );
  }

  return (
    <Box p={3} borderWidth="1px" borderRadius="md">
      <VStack align="stretch" gap={2}>
        <Text fontSize="sm" fontWeight="medium">
          Select a bank account to link:
        </Text>
        {accounts.map((account) => (
          <HStack
            key={account.account_id}
            p={2}
            borderWidth="1px"
            borderRadius="md"
            justify="space-between"
            _hover={{ bg: 'bg.subtle' }}
            cursor="pointer"
            onClick={() => !isLinking && onSelect(account.account_id)}
          >
            <VStack align="start" gap={0}>
              <Text fontSize="sm" fontWeight="medium">
                {account.account_name}
              </Text>
              <Text fontSize="xs" color="fg.muted">
                {account.account_type} · {account.currency}
                {account.account_number && ` · ****${account.account_number.slice(-4)}`}
              </Text>
            </VStack>
            {isLinking && <Spinner size="xs" />}
          </HStack>
        ))}
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </VStack>
    </Box>
  );
};
