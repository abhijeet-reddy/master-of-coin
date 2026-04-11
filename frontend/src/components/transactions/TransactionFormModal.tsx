import { useEffect, useState } from 'react';
import { Badge, Box, Button, HStack, Input, Text, Textarea, VStack } from '@chakra-ui/react';
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
import { DebtExpenseParticipantsForm } from './DebtExpenseParticipantsForm';
import { useTransactionSplitState } from '@/hooks/usecase';
import { CurrencyCode } from '@/types';
import type {
  Account,
  Category,
  Person,
  PayerMode,
  Transaction,
  TransactionFormDefaultValues,
  ExpenseParticipantInput,
  CreateTransactionRequest,
  CreateDebtTransactionRequest,
  UpdateExpenseDetailsRequest,
} from '@/types';

// Validation schema
const transactionSchema = z
  .object({
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
    payer_mode: z.enum(['self', 'other']),
    account_id: z.string().optional(),
    payer_person_id: z.string().optional(),
    payer_currency: z.string().optional(),
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
  })
  .refine(
    (data) => {
      if (data.payer_mode === 'self') {
        return !!data.account_id && data.account_id.trim() !== '';
      }
      return !!data.payer_person_id && data.payer_person_id.trim() !== '';
    },
    {
      message: 'Account is required when you paid, or select who paid',
      path: ['account_id'],
    }
  );

type TransactionFormData = z.infer<typeof transactionSchema>;

interface TransactionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction?: Transaction;
  accounts: Account[];
  categories: Category[];
  people: Person[];
  onSubmit: (data: CreateTransactionRequest) => Promise<void>;
  onSubmitDebt?: (data: CreateDebtTransactionRequest) => Promise<void>;
  defaultAccountId?: string;
  /** Pre-fill form values for duplicate (create mode, not edit mode) */
  defaultValues?: TransactionFormDefaultValues;
  onSubmitDebtMetadata?: (
    transactionId: string,
    data: UpdateExpenseDetailsRequest
  ) => Promise<void>;
}

export const TransactionFormModal = ({
  isOpen,
  onClose,
  transaction,
  accounts,
  categories,
  people,
  onSubmit,
  onSubmitDebt,
  defaultAccountId,
  defaultValues,
  onSubmitDebtMetadata,
}: TransactionFormModalProps) => {
  const [expenseParticipants, setExpenseParticipants] = useState<ExpenseParticipantInput[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      title: '',
      amount: '',
      transaction_type: 'expense',
      payer_mode: 'self',
      account_id: defaultAccountId || '',
      payer_person_id: '',
      payer_currency: CurrencyCode.EUR,
      category_id: '',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5),
      notes: '',
    },
  });

  const amount = watch('amount');
  const payerMode = watch('payer_mode') as PayerMode;

  // Split state managed by custom hook
  const {
    isSplitEnabled,
    splits,
    canSplit,
    toggleSplit,
    setSplits,
    clearSplits,
    initFromTransaction,
  } = useTransactionSplitState({
    payerMode,
    isDebtTransaction: !!transaction?.debt_metadata,
  });

  // Whether we're editing a debt transaction with expense participants
  const isDebtWithParticipants =
    !!transaction && payerMode === 'other' && expenseParticipants.length > 0;

  // Reset form when modal opens/closes or transaction changes
  useEffect(() => {
    if (isOpen) {
      if (transaction) {
        const transactionAmount = parseFloat(transaction.amount);
        const transactionDate = new Date(transaction.date);
        const isDebtTransaction = !!transaction.debt_metadata;
        reset({
          title: transaction.title,
          amount: Math.abs(transactionAmount).toString(),
          transaction_type: transactionAmount >= 0 ? 'income' : 'expense',
          payer_mode: isDebtTransaction ? 'other' : 'self',
          account_id: isDebtTransaction ? '' : transaction.account_id,
          payer_person_id: transaction.debt_metadata?.payer_person_id || '',
          payer_currency: CurrencyCode.EUR,
          category_id: transaction.category_id || '',
          date: transaction.date.split('T')[0],
          time: transactionDate.toTimeString().slice(0, 5),
          notes: transaction.notes || '',
        });
        initFromTransaction(transaction.splits || [], isDebtTransaction);

        // Initialize expense participants from debt_metadata
        if (
          isDebtTransaction &&
          transaction.debt_metadata?.expense_participants &&
          transaction.debt_metadata.expense_participants.length > 0
        ) {
          setExpenseParticipants(
            transaction.debt_metadata.expense_participants.map((p) => ({
              name: p.name,
              external_user_id: p.external_user_id ?? undefined,
              paid_share: p.paid_share,
              owed_share: p.owed_share,
            }))
          );
        } else {
          setExpenseParticipants([]);
        }
      } else if (defaultValues) {
        // Duplicate mode: pre-fill from source transaction with today's date/time
        reset({
          title: defaultValues.title || '',
          amount: defaultValues.amount || '',
          transaction_type: defaultValues.transaction_type || 'expense',
          payer_mode: defaultValues.payer_mode || 'self',
          account_id: defaultValues.account_id || defaultAccountId || '',
          payer_person_id: defaultValues.payer_person_id || '',
          payer_currency: defaultValues.payer_currency || CurrencyCode.EUR,
          category_id: defaultValues.category_id || '',
          date: new Date().toISOString().split('T')[0],
          time: new Date().toTimeString().slice(0, 5),
          notes: defaultValues.notes || '',
        });
        clearSplits();
        setExpenseParticipants([]);
      } else {
        reset({
          title: '',
          amount: '',
          transaction_type: 'expense',
          payer_mode: 'self',
          account_id: defaultAccountId || '',
          payer_person_id: '',
          payer_currency: CurrencyCode.EUR,
          category_id: '',
          date: new Date().toISOString().split('T')[0],
          time: new Date().toTimeString().slice(0, 5),
          notes: '',
        });
        clearSplits();
        setExpenseParticipants([]);
      }
    }
  }, [isOpen, transaction, defaultValues, reset, initFromTransaction, clearSplits]);

  // Track which participant index is the current user.
  // Identified at form open by matching owed_share to the transaction amount.
  const [userParticipantIndex, setUserParticipantIndex] = useState<number>(-1);

  // Identify the user's participant index when expense participants are first loaded
  useEffect(() => {
    if (!isDebtWithParticipants || userParticipantIndex >= 0) return;
    if (!transaction) return;

    const txAmount = Math.abs(parseFloat(transaction.amount));
    const idx = expenseParticipants.findIndex((p) => {
      const owed = parseFloat(p.owed_share) || 0;
      return Math.abs(owed - txAmount) < 0.01;
    });
    if (idx >= 0) {
      setUserParticipantIndex(idx);
    }
  }, [expenseParticipants, isDebtWithParticipants, transaction, userParticipantIndex]);

  // Auto-update amount when the user's participant owed_share changes
  useEffect(() => {
    if (!isDebtWithParticipants || userParticipantIndex < 0) return;
    if (userParticipantIndex >= expenseParticipants.length) return;

    const userShare = parseFloat(expenseParticipants[userParticipantIndex].owed_share) || 0;
    if (userShare > 0) {
      setValue('amount', userShare.toString());
    }
  }, [expenseParticipants, isDebtWithParticipants, userParticipantIndex, setValue]);

  const handleFormSubmit = async (data: TransactionFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const dateValue = data.date || new Date().toISOString().split('T')[0];
      const timeValue = data.time && data.time.trim() !== '' ? data.time : '00:00';
      const formattedDate = new Date(`${dateValue}T${timeValue}:00Z`).toISOString();

      const amountValue = parseFloat(data.amount);
      const signedAmount = data.transaction_type === 'income' ? amountValue : -amountValue;

      if (data.payer_mode === 'other') {
        if (transaction && isDebtWithParticipants && onSubmitDebtMetadata) {
          // Editing a debt transaction with expense participants:
          // 1) Update metadata (total_cost + participants)
          const totalCost = expenseParticipants.reduce(
            (sum, p) => sum + (parseFloat(p.owed_share) || 0),
            0
          );
          const metadataData: UpdateExpenseDetailsRequest = {
            total_cost: totalCost,
            expense_participants: expenseParticipants,
          };
          await onSubmitDebtMetadata(transaction.id, metadataData);

          // 2) Also update core transaction fields (title, category, date, notes, amount)
          const coreData: CreateTransactionRequest = {
            title: data.title,
            amount: signedAmount,
            date: formattedDate,
            account_id: transaction.account_id,
            category_id:
              data.category_id && data.category_id.trim() !== '' ? data.category_id : undefined,
            notes: data.notes && data.notes.trim() !== '' ? data.notes : undefined,
          };
          await onSubmit(coreData);
        } else if (transaction) {
          // Editing a debt transaction WITHOUT expense participants:
          // Update core transaction fields via the normal update endpoint
          const coreData: CreateTransactionRequest = {
            title: data.title,
            amount: signedAmount,
            date: formattedDate,
            account_id: transaction.account_id,
            category_id:
              data.category_id && data.category_id.trim() !== '' ? data.category_id : undefined,
            notes: data.notes && data.notes.trim() !== '' ? data.notes : undefined,
          };
          await onSubmit(coreData);
        } else if (onSubmitDebt) {
          // Creating a new debt transaction
          const debtData: CreateDebtTransactionRequest = {
            payer_person_id: data.payer_person_id!,
            currency: (data.payer_currency as CurrencyCode) || CurrencyCode.EUR,
            title: data.title,
            amount: signedAmount,
            date: formattedDate,
            category_id:
              data.category_id && data.category_id.trim() !== '' ? data.category_id : undefined,
            notes: data.notes && data.notes.trim() !== '' ? data.notes : undefined,
          };
          await onSubmitDebt(debtData);
        }
      } else {
        // "I paid" → create/update normal transaction
        const finalData: CreateTransactionRequest = {
          title: data.title,
          amount: signedAmount,
          date: formattedDate,
          account_id: data.account_id!,
          category_id:
            data.category_id && data.category_id.trim() !== '' ? data.category_id : undefined,
          notes: data.notes && data.notes.trim() !== '' ? data.notes : undefined,
          splits: isSplitEnabled
            ? splits.length > 0
              ? splits.map((split) => ({
                  person_id: split.person_id,
                  amount: parseFloat(split.amount),
                }))
              : []
            : transaction
              ? []
              : undefined,
        };
        await onSubmit(finalData);
      }
      onClose();
    } catch (error) {
      console.error('Failed to submit transaction:', error);
      setSubmitError(error instanceof Error ? error.message : 'Failed to save transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayerModeChange = (mode: PayerMode) => {
    setValue('payer_mode', mode);
    if (mode === 'other') {
      setValue('account_id', '');
      clearSplits();
    } else {
      setValue('payer_person_id', '');
      setExpenseParticipants([]);
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
                  readOnly={isDebtWithParticipants}
                />
              </Field>

              {/* "Amount auto-calculated" hint for debt with participants */}
              {isDebtWithParticipants && (
                <Text fontSize="xs" color="fg.muted" mt={-2}>
                  Amount is auto-calculated from your share below.
                </Text>
              )}

              {/* Who Paid? Toggle */}
              {!transaction && onSubmitDebt && (
                <Field label="Who paid?">
                  <HStack gap={2}>
                    <Button
                      size="sm"
                      variant={payerMode === 'self' ? 'solid' : 'outline'}
                      colorScheme={payerMode === 'self' ? 'blue' : 'gray'}
                      onClick={() => handlePayerModeChange('self')}
                      type="button"
                    >
                      I paid
                    </Button>
                    <Button
                      size="sm"
                      variant={payerMode === 'other' ? 'solid' : 'outline'}
                      colorScheme={payerMode === 'other' ? 'orange' : 'gray'}
                      onClick={() => handlePayerModeChange('other')}
                      type="button"
                    >
                      Someone else paid
                    </Button>
                  </HStack>
                </Field>
              )}

              {/* Account (shown when "I paid") */}
              {payerMode === 'self' && (
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
              )}

              {/* Payer Person + Currency (shown when "Someone else paid") */}
              {payerMode === 'other' && (
                <>
                  <Field label="Paid by" required>
                    <select
                      {...register('payer_person_id')}
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '6px',
                        border: '1px solid #E2E8F0',
                      }}
                    >
                      <option value="">Select person</option>
                      {people.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {!isDebtWithParticipants && (
                    <Field label="Currency">
                      <select
                        {...register('payer_currency')}
                        style={{
                          width: '100%',
                          padding: '8px',
                          borderRadius: '6px',
                          border: '1px solid #E2E8F0',
                        }}
                      >
                        {Object.values(CurrencyCode).map((code) => (
                          <option key={code} value={code}>
                            {code}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}

                  {!isDebtWithParticipants && (
                    <Badge colorScheme="orange" p={2} borderRadius="md">
                      <Text fontSize="sm">
                        This won&apos;t affect any account balance. A debt will be tracked.
                      </Text>
                    </Badge>
                  )}
                </>
              )}

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
                      {category.icon} {category.name}
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

              {/* Expense Participants (for debt transactions with participants) */}
              {isDebtWithParticipants && (
                <Box p={4} bg="bg.muted" borderRadius="md">
                  <Text fontSize="md" fontWeight="semibold" mb={3}>
                    Expense Participants
                  </Text>
                  <DebtExpenseParticipantsForm
                    participants={expenseParticipants}
                    onChange={setExpenseParticipants}
                    userShare={parseFloat(amount) || 0}
                    userIndex={userParticipantIndex}
                  />
                </Box>
              )}

              {/* Split Payment Toggle (when "I paid" mode) */}
              {canSplit && (
                <Box>
                  <Button
                    size="sm"
                    variant={isSplitEnabled ? 'solid' : 'outline'}
                    colorScheme={isSplitEnabled ? 'blue' : 'gray'}
                    onClick={toggleSplit}
                    type="button"
                  >
                    {isSplitEnabled ? 'Disable' : 'Enable'} Split Payment
                  </Button>
                </Box>
              )}

              {/* Split Payment Form */}
              {isSplitEnabled && canSplit && (
                <Box p={4} bg="bg.muted" borderRadius="md">
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
