import { useEffect } from 'react';
import { Button, HStack, Input, Textarea, VStack } from '@chakra-ui/react';
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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Field } from '@/components/ui/field';
import { ErrorAlert } from '@/components/common';
import useCreateAccount from '@/hooks/api/useCreateAccount';
import useUpdateAccount from '@/hooks/api/useUpdateAccount';
import type { Account } from '@/types';
import { DEFAULT_CURRENCY, CURRENCIES } from '@/constants';
import { CurrencyCode } from '@/types';

// Validation schema
const accountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  type: z.enum(['CHECKING', 'SAVINGS', 'CREDIT_CARD', 'INVESTMENT', 'CASH', 'LOAN', 'OTHER']),
  currency: z.nativeEnum(CurrencyCode),
  notes: z.string().max(500, 'Notes must be less than 500 characters').optional(),
});

type AccountFormData = z.infer<typeof accountSchema>;

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

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: '',
      type: 'CHECKING',
      currency: DEFAULT_CURRENCY,
      notes: '',
    },
  });

  // Reset form when modal opens/closes or account changes
  useEffect(() => {
    if (isOpen) {
      if (account) {
        reset({
          name: account.name,
          type: account.account_type,
          currency: account.currency,
          notes: account.notes || '',
        });
      } else {
        reset({
          name: '',
          type: 'CHECKING',
          currency: DEFAULT_CURRENCY,
          notes: '',
        });
      }
    }
  }, [isOpen, account, reset]);

  const handleFormSubmit = (data: AccountFormData) => {
    const accountData = {
      name: data.name,
      account_type: data.type,
      currency: data.currency,
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
      // Create new account
      createMutation.mutate(accountData, {
        onSuccess: () => {
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
                  <option value="OTHER">Other</option>
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
