import { useEffect, useState } from 'react';
import { Box, Button, HStack, Input, Textarea, VStack } from '@chakra-ui/react';
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
import { SplitPaymentForm } from './SplitPaymentForm';
import type {
  Account,
  Category,
  Person,
  Transaction,
  TransactionSplit,
  CreateTransactionRequest,
} from '@/types';

// Validation schema
const transactionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0;
      },
      { message: 'Amount must be a positive number' }
    ),
  transaction_type: z.enum(['income', 'expense']),
  account_id: z.string().min(1, 'Account is required'),
  category_id: z.string().optional(),
  date: z
    .string()
    .min(1, 'Date is required')
    .refine(
      (val) => {
        const date = new Date(val);
        const now = new Date();
        return date <= now;
      },
      { message: 'Date cannot be in the future' }
    ),
  time: z.string().min(1, 'Time is required'),
  notes: z.string().optional(),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

interface TransactionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction?: Transaction;
  accounts: Account[];
  categories: Category[];
  people: Person[];
  onSubmit: (data: CreateTransactionRequest) => Promise<void>;
}

export const TransactionFormModal = ({
  isOpen,
  onClose,
  transaction,
  accounts,
  categories,
  people,
  onSubmit,
}: TransactionFormModalProps) => {
  const [isSplitEnabled, setIsSplitEnabled] = useState(false);
  const [splits, setSplits] = useState<TransactionSplit[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      title: '',
      amount: '',
      transaction_type: 'expense',
      account_id: '',
      category_id: '',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5), // HH:MM format
      notes: '',
    },
  });

  const amount = watch('amount');

  // Reset form when modal opens/closes or transaction changes
  useEffect(() => {
    if (isOpen) {
      if (transaction) {
        const transactionAmount = parseFloat(transaction.amount);
        const transactionDate = new Date(transaction.date);
        reset({
          title: transaction.title,
          amount: Math.abs(transactionAmount).toString(),
          transaction_type: transactionAmount >= 0 ? 'income' : 'expense',
          account_id: transaction.account_id,
          category_id: transaction.category_id || '',
          date: transaction.date.split('T')[0],
          time: transactionDate.toTimeString().slice(0, 5), // Extract HH:MM
          notes: transaction.notes || '',
        });
        setIsSplitEnabled(!!transaction.splits && transaction.splits.length > 0);
        setSplits(transaction.splits || []);
      } else {
        reset({
          title: '',
          amount: '',
          transaction_type: 'expense',
          account_id: '',
          category_id: '',
          date: new Date().toISOString().split('T')[0],
          time: new Date().toTimeString().slice(0, 5), // HH:MM format
          notes: '',
        });
        setIsSplitEnabled(false);
        setSplits([]);
      }
    }
  }, [isOpen, transaction, reset]);

  const handleFormSubmit = async (data: TransactionFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const dateValue = data.date || new Date().toISOString().split('T')[0];
      const timeValue = data.time && data.time.trim() !== '' ? data.time : '00:00';

      // Combine date and time into ISO 8601 datetime format
      const formattedDate = new Date(`${dateValue}T${timeValue}:00Z`).toISOString();

      // Set amount sign based on transaction type
      // Income = positive, Expense = negative
      const amountValue = parseFloat(data.amount);
      const signedAmount = data.transaction_type === 'income' ? amountValue : -amountValue;

      const finalData = {
        title: data.title,
        amount: signedAmount,
        date: formattedDate, // ISO 8601 datetime format with time
        account_id: data.account_id,
        category_id:
          data.category_id && data.category_id.trim() !== '' ? data.category_id : undefined,
        notes: data.notes && data.notes.trim() !== '' ? data.notes : undefined,
        splits:
          isSplitEnabled && splits.length > 0
            ? splits.map((split) => ({
                person_id: split.person_id,
                amount: parseFloat(split.amount), // Convert string to number
              }))
            : undefined,
      };

      await onSubmit(finalData);
      onClose();
    } catch (error) {
      console.error('Failed to submit transaction:', error);
      setSubmitError(error instanceof Error ? error.message : 'Failed to save transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSplitToggle = () => {
    setIsSplitEnabled(!isSplitEnabled);
    if (isSplitEnabled) {
      setSplits([]);
    }
  };

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
          <DialogTitle>{transaction ? 'Edit Transaction' : 'Add Transaction'}</DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>

        <DialogBody>
          <form
            id="transaction-form"
            onSubmit={(e) => {
              void handleSubmit(handleFormSubmit)(e);
            }}
          >
            <VStack align="stretch" gap={4}>
              {/* Error Alert */}
              {submitError && <ErrorAlert error={new Error(submitError)} />}

              {/* Title */}
              <Field label="Title" required errorText={errors.title?.message}>
                <Input {...register('title')} placeholder="e.g., Grocery shopping" />
              </Field>

              {/* Transaction Type */}
              <Field label="Type" required errorText={errors.transaction_type?.message}>
                <select
                  {...register('transaction_type')}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </Field>

              {/* Amount */}
              <Field label="Amount" required errorText={errors.amount?.message}>
                <Input
                  {...register('amount')}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                />
              </Field>

              {/* Account */}
              <Field label="Account" required errorText={errors.account_id?.message}>
                <select
                  {...register('account_id')}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <option value="">Select account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </Field>

              {/* Category */}
              <Field label="Category">
                <select
                  {...register('category_id')}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <option value="">Select category (optional)</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </Field>

              {/* Date and Time */}
              <HStack align="start" gap={4}>
                <Box flex={1}>
                  <Field label="Date" required errorText={errors.date?.message}>
                    <Input {...register('date')} type="date" />
                  </Field>
                </Box>
                <Box flex={1}>
                  <Field label="Time" required errorText={errors.time?.message}>
                    <Input {...register('time')} type="time" />
                  </Field>
                </Box>
              </HStack>

              {/* Notes */}
              <Field label="Notes">
                <Textarea
                  {...register('notes')}
                  placeholder="Add any additional notes..."
                  rows={3}
                />
              </Field>

              {/* Split Payment Toggle */}
              <Box>
                <Button
                  size="sm"
                  variant={isSplitEnabled ? 'solid' : 'outline'}
                  colorScheme={isSplitEnabled ? 'blue' : 'gray'}
                  onClick={handleSplitToggle}
                  type="button"
                >
                  {isSplitEnabled ? 'Disable' : 'Enable'} Split Payment
                </Button>
              </Box>

              {/* Split Payment Form */}
              {isSplitEnabled && (
                <Box p={4} bg="gray.50" borderRadius="md">
                  <SplitPaymentForm
                    totalAmount={parseFloat(amount) || 0}
                    splits={splits}
                    people={people}
                    onChange={setSplits}
                  />
                </Box>
              )}
            </VStack>
          </form>
        </DialogBody>

        <DialogFooter>
          <HStack gap={2}>
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="transaction-form" colorScheme="blue" loading={isSubmitting}>
              {transaction ? 'Update' : 'Create'}
            </Button>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
