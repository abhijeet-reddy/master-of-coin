import { useEffect, useRef, useState } from 'react';
import { Button, HStack, Input, Separator, Text, Textarea, VStack } from '@chakra-ui/react';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
  DialogBackdrop,
} from '@chakra-ui/react';
import { FaChartLine } from 'react-icons/fa';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Field } from '@/components/ui/field';
import { ErrorAlert } from '@/components/common';
import { BrokerageConnectionConfig } from './BrokerageConnectionConfig';
import { BankConnectionConfig } from '@/components/bank';
import { ConnectProviderForm } from './ConnectProviderForm';
import useCreateAccount from '@/hooks/api/useCreateAccount';
import useUpdateAccount from '@/hooks/api/useUpdateAccount';
import { useConnectInvestmentProvider } from '@/hooks/api/useInvestmentProviders';
import { toaster } from '@/components/ui/toaster';
import type { Account } from '@/types';
import { DEFAULT_CURRENCY, CURRENCIES } from '@/constants';
import { AccountType, CurrencyCode, InvestmentProviderType } from '@/types';

// Validation schema
const accountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  type: z.nativeEnum(AccountType),
  currency: z.nativeEnum(CurrencyCode),
  initial_balance: z.number().optional(),
  notes: z.string().max(500, 'Notes must be less than 500 characters').optional(),
});

type AccountFormData = z.infer<typeof accountSchema>;

/** Pending provider credentials collected during account creation */
interface PendingProviderCredentials {
  providerType: InvestmentProviderType;
  apiKey: string;
  apiSecret: string;
  environment?: string;
}

interface AccountFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  account?: Account;
  onSuccess: () => void;
}

export const AccountFormModal = ({
  isOpen,
  onClose,
  account,
  onSuccess,
}: AccountFormModalProps) => {
  const createMutation = useCreateAccount();
  const updateMutation = useUpdateAccount();
  const connectMutation = useConnectInvestmentProvider();

  // Store provider credentials for create mode (connected after account creation)
  const pendingCredentialsRef = useRef<PendingProviderCredentials | null>(null);
  const [hasProviderCredentials, setHasProviderCredentials] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
  } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: '',
      type: AccountType.CHECKING,
      currency: DEFAULT_CURRENCY,
      initial_balance: 0,
      notes: '',
    },
  });

  const watchedType = watch('type');

  // Reset form when modal opens/closes or account changes
  useEffect(() => {
    if (isOpen) {
      pendingCredentialsRef.current = null;
      setHasProviderCredentials(false);
      if (account) {
        reset({
          name: account.name,
          type: account.account_type,
          currency: account.currency,
          initial_balance: 0,
          notes: account.notes || '',
        });
      } else {
        reset({
          name: '',
          type: AccountType.CHECKING,
          currency: DEFAULT_CURRENCY,
          initial_balance: 0,
          notes: '',
        });
      }
    }
  }, [isOpen, account, reset]);

  /** Store provider credentials for later (will be connected after account creation) */
  const handleStoreCredentials = (
    providerType: InvestmentProviderType,
    apiKey: string,
    apiSecret: string,
    environment?: string
  ) => {
    pendingCredentialsRef.current = { providerType, apiKey, apiSecret, environment };
    setHasProviderCredentials(true);
    toaster.create({
      title: 'Provider credentials saved',
      description: 'The brokerage will be connected when you create the account.',
      type: 'info',
    });
  };

  /** Connect provider to a newly created account */
  const connectProviderToAccount = (accountId: string, creds: PendingProviderCredentials) => {
    connectMutation.mutate(
      {
        account_id: accountId,
        provider_type: creds.providerType,
        api_key: creds.apiKey,
        api_secret: creds.apiSecret,
        environment: creds.environment,
      },
      {
        onSuccess: () => {
          toaster.create({
            title: 'Provider Connected',
            description: 'Brokerage has been connected to the new account.',
            type: 'success',
          });
        },
        onError: (error) => {
          const message =
            error instanceof Error
              ? error.message
              : 'Account was created but could not connect the brokerage. You can connect it from the account edit page.';
          toaster.create({
            title: 'Provider Connection Failed',
            description: message,
            type: 'error',
          });
        },
      }
    );
  };

  const handleFormSubmit = (data: AccountFormData) => {
    const accountData = {
      name: data.name,
      account_type: data.type,
      currency: data.currency,
      initial_balance: data.initial_balance,
      notes: data.notes && data.notes.trim() !== '' ? data.notes : undefined,
    };

    if (account) {
      // Update existing account
      updateMutation.mutate(
        { id: account.id, data: accountData },
        {
          onSuccess: () => {
            onSuccess();
            onClose();
          },
        }
      );
    } else {
      // Create new account, then connect provider if credentials were provided
      createMutation.mutate(accountData, {
        onSuccess: (newAccount) => {
          const creds = pendingCredentialsRef.current;
          if (creds) {
            connectProviderToAccount(newAccount.id, creds);
          }
          onSuccess();
          onClose();
        },
      });
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error || updateMutation.error;

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="lg">
      <DialogBackdrop />
      <DialogContent
        css={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 9999,
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <DialogHeader>
          <DialogTitle>{account ? 'Edit Account' : 'Add Account'}</DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>

        <DialogBody>
          <form
            id="account-form"
            onSubmit={(e) => {
              void handleSubmit(handleFormSubmit)(e);
            }}
          >
            <VStack align="stretch" gap={4}>
              {/* Error Alert */}
              {mutationError && <ErrorAlert error={mutationError} />}

              {/* Account Name */}
              <Field label="Account Name" required errorText={errors.name?.message}>
                <Input {...register('name')} placeholder="e.g., Chase Checking" />
              </Field>

              {/* Account Type */}
              <Field label="Account Type" required errorText={errors.type?.message}>
                <select
                  {...register('type')}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <option value="CHECKING">Checking</option>
                  <option value="SAVINGS">Savings</option>
                  <option value="CREDIT_CARD">Credit Card</option>
                  <option value="INVESTMENT">Investment</option>
                  <option value="CASH">Cash</option>
                  <option value="LOAN">Loan</option>
                </select>
              </Field>

              {/* Currency */}
              <Field label="Currency" required errorText={errors.currency?.message}>
                <select
                  {...register('currency')}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.code} - {currency.name} ({currency.symbol})
                    </option>
                  ))}
                </select>
              </Field>

              {/* Initial Balance - Only show when creating new account */}
              {!account && (
                <Field
                  label="Initial Balance"
                  errorText={errors.initial_balance?.message}
                  helperText="Enter the starting balance for this account (can be negative for loans/credit cards)"
                >
                  <Input
                    {...register('initial_balance', { valueAsNumber: true })}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                  />
                </Field>
              )}

              {/* Notes */}
              <Field label="Notes" errorText={errors.notes?.message}>
                <Textarea
                  {...register('notes')}
                  placeholder="Add any additional notes..."
                  rows={3}
                />
              </Field>
            </VStack>
          </form>

          {/* Brokerage Connection Section (Investment accounts only) */}
          {watchedType === AccountType.INVESTMENT && account && (
            <BrokerageConnectionConfig accountId={account.id} />
          )}

          {/* Bank Connection Section (Checking/Savings/Credit Card accounts) */}
          {(watchedType === AccountType.CHECKING ||
            watchedType === AccountType.SAVINGS ||
            watchedType === AccountType.CREDIT_CARD) &&
            account && <BankConnectionConfig accountId={account.id} />}

          {/* Create mode: show connect form to collect credentials */}
          {watchedType === AccountType.INVESTMENT && !account && (
            <VStack align="stretch" gap={3} mt={4}>
              <Separator />
              <HStack gap={2}>
                <FaChartLine color="green" />
                <Text fontWeight="semibold" fontSize="sm">
                  Brokerage Connection
                </Text>
              </HStack>
              {hasProviderCredentials ? (
                <Text fontSize="sm" color="green.600">
                  ✓ Provider credentials saved. They will be connected when you create the account.
                </Text>
              ) : (
                <ConnectProviderForm
                  onSubmit={handleStoreCredentials}
                  isLoading={false}
                  onCancel={() => {
                    /* no-op */
                  }}
                />
              )}
            </VStack>
          )}
        </DialogBody>

        <DialogFooter>
          <HStack gap={2}>
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="account-form" colorScheme="blue" loading={isSubmitting}>
              {account ? 'Update' : 'Create'}
            </Button>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
