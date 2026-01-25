import { useState } from 'react';
import { Box, Button } from '@chakra-ui/react';
import { PageHeader, ConfirmDialog, ErrorAlert } from '@/components/common';
import { TotalBalanceCard, AccountList, AccountFormModal } from '@/components/accounts';
import { useDocumentTitle } from '@/hooks';
import useAccounts from '@/hooks/api/useAccounts';
import useDeleteAccount from '@/hooks/api/useDeleteAccount';
import type { Account } from '@/types';

export const Accounts = () => {
  useDocumentTitle('Accounts');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | undefined>(undefined);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; account: Account | null }>({
    isOpen: false,
    account: null,
  });

  const { data: accounts = [], isLoading, error } = useAccounts();
  const deleteMutation = useDeleteAccount();

  // Query error state
  if (error) {
    return (
      <Box>
        <PageHeader title="Accounts" />
        <ErrorAlert title="Failed to load accounts" error={error} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Delete Error Alert */}
      {deleteMutation.isError && deleteMutation.error && (
        <ErrorAlert title="Failed to delete account" error={deleteMutation.error} />
      )}

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
          setDeleteDialog({ isOpen: true, account });
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

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, account: null })}
        onConfirm={() => {
          if (deleteDialog.account) {
            deleteMutation.mutate(deleteDialog.account.id, {
              onSuccess: () => {
                setDeleteDialog({ isOpen: false, account: null });
              },
            });
          }
        }}
        title="Delete Account"
        message={`Are you sure you want to delete "${deleteDialog.account?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        colorScheme="red"
        isLoading={deleteMutation.isPending}
      />
    </Box>
  );
};
