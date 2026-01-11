import { SimpleGrid, Skeleton } from '@chakra-ui/react';
import { AccountCard } from './AccountCard';
import { EmptyState } from '@/components/common';
import type { Account } from '@/types';

interface AccountListProps {
  accounts: Account[];
  isLoading?: boolean;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
}

export const AccountList = ({ accounts, isLoading, onEdit, onDelete }: AccountListProps) => {
  // Loading skeleton
  if (isLoading) {
    return (
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={6}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} height="200px" borderRadius="md" />
        ))}
      </SimpleGrid>
    );
  }

  // Empty state
  if (accounts.length === 0) {
    return (
      <EmptyState
        title="No accounts yet"
        description="Create your first account to start tracking your finances"
      />
    );
  }

  // Account grid
  return (
    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={6}>
      {accounts.map((account) => (
        <AccountCard
          key={account.id}
          account={account}
          onEdit={() => onEdit(account)}
          onDelete={() => onDelete(account)}
        />
      ))}
    </SimpleGrid>
  );
};
