import { Button, HStack, Text, Textarea, VStack } from '@chakra-ui/react';
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
import { useSettleDebt, useAccounts } from '@/hooks';
import { formatCurrency } from '@/utils/formatters';
import type { Person } from '@/types';

// Validation schema
const settleDebtSchema = z.object({
  account_id: z.string().min(1, 'Account is required'),
  notes: z.string().max(500, 'Notes must be less than 500 characters').optional(),
});

type SettleDebtFormData = z.infer<typeof settleDebtSchema>;

interface SettleDebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  person: Person;
  debtAmount: number;
  onSuccess: () => void;
}

export const SettleDebtModal = ({
  isOpen,
  onClose,
  person,
  debtAmount,
  onSuccess,
}: SettleDebtModalProps) => {
  const settleMutation = useSettleDebt();
  const { data: accounts = [] } = useAccounts();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<SettleDebtFormData>({
    resolver: zodResolver(settleDebtSchema),
    defaultValues: {
      account_id: '',
      notes: '',
    },
  });

  const handleFormSubmit = (data: SettleDebtFormData) => {
    settleMutation.mutate(
      {
        personId: person.id,
        data: {
          account_id: data.account_id,
          notes: data.notes && data.notes.trim() !== '' ? data.notes : undefined,
        },
      },
      {
        onSuccess: () => {
          reset();
          onSuccess();
          onClose();
        },
      }
    );
  };

  const isSubmitting = settleMutation.isPending;

  // Determine debt direction
  const isOwedToMe = debtAmount > 0;
  const debtText = isOwedToMe ? 'owes you' : 'you owe';
  const settlementText = isOwedToMe
    ? 'This will create a transaction recording the payment received.'
    : 'This will create a transaction recording the payment made.';

  return (
    <DialogRoot
      open={isOpen}
      onOpenChange={(e) => {
        if (!e.open) {
          reset();
          onClose();
        }
      }}
      size="lg"
    >
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
          <DialogTitle>Settle Debt with {person.name}</DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>

        <DialogBody>
          <VStack align="stretch" gap={4}>
            {/* Debt Amount Display */}
            <VStack align="start" gap={2} p={4} bg="gray.50" borderRadius="md">
              <Text fontSize="sm" color="gray.600">
                {person.name} {debtText}:
              </Text>
              <Text fontSize="2xl" fontWeight="bold" color={isOwedToMe ? 'green.600' : 'red.600'}>
                {formatCurrency(Math.abs(debtAmount))}
              </Text>
              <Text fontSize="sm" color="gray.600">
                {settlementText}
              </Text>
            </VStack>

            <form
              id="settle-debt-form"
              onSubmit={(e) => {
                void handleSubmit(handleFormSubmit)(e);
              }}
            >
              <VStack align="stretch" gap={4}>
                {/* Account Selection */}
                <Field label="Settlement Account" required errorText={errors.account_id?.message}>
                  <select
                    {...register('account_id')}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '6px',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    <option value="">Select an account</option>
                    {accounts
                      .filter((acc) => acc.is_active)
                      .map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} ({formatCurrency(account.balance, account.currency)})
                        </option>
                      ))}
                  </select>
                </Field>

                {/* Notes */}
                <Field label="Notes" errorText={errors.notes?.message}>
                  <Textarea
                    {...register('notes')}
                    placeholder={`Settlement with ${person.name}`}
                    rows={3}
                  />
                </Field>
              </VStack>
            </form>
          </VStack>
        </DialogBody>

        <DialogFooter>
          <HStack gap={2}>
            <Button
              variant="outline"
              onClick={() => {
                reset();
                onClose();
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="settle-debt-form"
              colorScheme={isOwedToMe ? 'green' : 'red'}
              loading={isSubmitting}
            >
              Settle Debt
            </Button>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
