import { useState } from 'react';
import { Box, Button } from '@chakra-ui/react';
import { PageHeader } from '@/components/common';
import { TotalBalanceCard, AccountList, AccountFormModal } from '@/components/accounts';
import { useDocumentTitle } from '@/hooks';
import useAccounts from '@/hooks/api/useAccounts';
import useDeleteAccount from '@/hooks/api/useDeleteAccount';
import type { Account } from '@/types';

export const Accounts = () => {
  useDocumentTitle('Accounts');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | undefined>(undefined);

  const { data: accounts = [], isLoading, error } = useAccounts();
  const { mutate: deleteAccount } = useDeleteAccount();

  // Error state
  if (error) {
    return (
      <Box>
        <PageHeader title="Accounts" />
        <Box bg="red.50" p={6} borderRadius="lg" border="1px solid" borderColor="red.200">
          <Box color="red.800" fontWeight="semibold" mb={2}>
            Error loading accounts
          </Box>
          <Box color="red.600" fontSize="sm">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Accounts"
        subtitle="Manage your financial accounts"
        actions={
          <Button
            colorScheme="blue"
            onClick={() => {
              setSelectedAccount(undefined);
              setIsFormOpen(true);
            }}
          >
            Add Account
          </Button>
        }
      />

      {/* Total Balance Card */}
      {!isLoading && accounts.length > 0 && <TotalBalanceCard accounts={accounts} />}

      {/* Account List */}
      <AccountList
        accounts={accounts}
        isLoading={isLoading}
        onEdit={(account) => {
          setSelectedAccount(account);
          setIsFormOpen(true);
        }}
        onDelete={(account) => {
          if (confirm(`Are you sure you want to delete "${account.name}"?`)) {
            deleteAccount(account.id);
          }
        }}
      />

      {/* Account Form Modal */}
      <AccountFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedAccount(undefined);
        }}
        account={selectedAccount}
        onSuccess={() => {
          setIsFormOpen(false);
          setSelectedAccount(undefined);
        }}
      />
    </Box>
  );
};
