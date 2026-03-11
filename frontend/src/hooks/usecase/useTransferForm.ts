import { useEffect, useCallback, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateTransfer } from '@/hooks/api';
import { toaster } from '@/components/ui/toaster';
import { AccountType } from '@/types';
import type { Account, Category, CreateTransferRequest } from '@/types';

// Validation schema
const transferSchema = z.object({
  from_account_id: z.string().min(1, 'From account is required'),
  to_account_id: z.string().min(1, 'To account is required'),
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
  to_amount: z.string().optional(),
  exchange_rate: z.string().optional(),
  date: z.string().min(1, 'Date is required'),
  time: z.string().min(1, 'Time is required'),
  title: z.string().optional(),
  notes: z.string().optional(),
  category_id: z.string().optional(),
});

export type TransferFormData = z.infer<typeof transferSchema>;

const DEFAULT_VALUES: TransferFormData = {
  from_account_id: '',
  to_account_id: '',
  amount: '',
  to_amount: '',
  exchange_rate: '',
  date: new Date().toISOString().split('T')[0],
  time: new Date().toTimeString().slice(0, 5),
  title: '',
  notes: '',
  category_id: '',
};

interface UseTransferFormOptions {
  open: boolean;
  accounts: Account[];
  categories?: Category[];
  onSuccess?: () => void;
  onClose: () => void;
}

/**
 * Extracts all transfer form logic: validation, cross-currency computation,
 * account filtering, and submission via the useCreateTransfer mutation.
 */
export default function useTransferForm({
  open,
  accounts,
  categories,
  onSuccess,
  onClose,
}: UseTransferFormOptions) {
  const createTransferMutation = useCreateTransfer();
  const mutationResetRef = useRef(createTransferMutation.reset);
  mutationResetRef.current = createTransferMutation.reset;

  const form = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const { reset, watch, setValue } = form;

  const fromAccountId = watch('from_account_id');
  const toAccountId = watch('to_account_id');
  const amount = watch('amount');
  const toAmount = watch('to_amount');
  const exchangeRate = watch('exchange_rate');

  // Track which field the user last edited to avoid circular updates
  const [lastEditedField, setLastEditedField] = useState<
    'amount' | 'to_amount' | 'exchange_rate' | null
  >(null);

  // Filter out DEBT accounts
  const transferableAccounts = accounts.filter((a) => a.account_type !== AccountType.DEBT);

  // Accounts available for "To" dropdown (exclude selected from-account)
  const toAccountOptions = transferableAccounts.filter((a) => a.id !== fromAccountId);

  const fromAccount = transferableAccounts.find((a) => a.id === fromAccountId);
  const toAccount = transferableAccounts.find((a) => a.id === toAccountId);

  const isCrossCurrency =
    !!fromAccount && !!toAccount && fromAccount.currency !== toAccount.currency;

  // Title placeholder based on selected to-account
  const titlePlaceholder = toAccount ? `Transfer to ${toAccount.name}` : 'Transfer to...';

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      reset(DEFAULT_VALUES);
      mutationResetRef.current();

      // Auto-select the "Transfer" category if available
      const transferCategory = categories?.find((c) => c.name.toLowerCase() === 'transfer');
      if (transferCategory) {
        setValue('category_id', transferCategory.id);
      }
    }
  }, [open, reset, categories, setValue]);

  // Clear to_account if it matches from_account
  useEffect(() => {
    if (fromAccountId && toAccountId && fromAccountId === toAccountId) {
      setValue('to_account_id', '');
    }
  }, [fromAccountId, toAccountId, setValue]);

  // --- Cross-currency bidirectional computation ---
  const recomputeCrossCurrency = useCallback(() => {
    if (!isCrossCurrency) return;

    const fromAmt = parseFloat(amount || '0');
    const toAmt = parseFloat(toAmount || '0');
    const rate = parseFloat(exchangeRate || '0');

    if (lastEditedField === 'to_amount' && fromAmt > 0 && toAmt > 0) {
      const newRate = toAmt / fromAmt;
      setValue('exchange_rate', newRate.toFixed(6));
    } else if (lastEditedField === 'exchange_rate' && fromAmt > 0 && rate > 0) {
      const newToAmount = fromAmt * rate;
      setValue('to_amount', newToAmount.toFixed(2));
    } else if (lastEditedField === 'amount' && fromAmt > 0 && rate > 0) {
      const newToAmount = fromAmt * rate;
      setValue('to_amount', newToAmount.toFixed(2));
    }
  }, [isCrossCurrency, amount, toAmount, exchangeRate, lastEditedField, setValue]);

  useEffect(() => {
    recomputeCrossCurrency();
  }, [recomputeCrossCurrency]);

  // Build the API request from form data
  const buildRequest = useCallback(
    (data: TransferFormData): CreateTransferRequest => {
      const fromAmount = parseFloat(data.amount);
      const dateValue = data.date || new Date().toISOString().split('T')[0];
      const timeValue = data.time && data.time.trim() !== '' ? data.time : '00:00';
      const formattedDate = new Date(`${dateValue}T${timeValue}:00Z`).toISOString();

      const request: CreateTransferRequest = {
        from_account_id: data.from_account_id,
        to_account_id: data.to_account_id,
        from_amount: fromAmount,
        date: formattedDate,
        title: data.title && data.title.trim() !== '' ? data.title : undefined,
        notes: data.notes && data.notes.trim() !== '' ? data.notes : undefined,
        category_id:
          data.category_id && data.category_id.trim() !== '' ? data.category_id : undefined,
      };

      // Include to_amount for cross-currency transfers
      if (isCrossCurrency && data.to_amount) {
        const parsedToAmount = parseFloat(data.to_amount);
        if (!isNaN(parsedToAmount) && parsedToAmount > 0) {
          request.to_amount = parsedToAmount;
        }
      }

      return request;
    },
    [isCrossCurrency]
  );

  const handleFormSubmit = async (data: TransferFormData) => {
    const request = buildRequest(data);
    await createTransferMutation.mutateAsync(request);

    toaster.create({
      title: 'Transfer Created',
      description: 'Transfer between accounts was successful.',
      type: 'success',
    });

    onSuccess?.();
    onClose();
  };

  return {
    form,
    isSubmitting: createTransferMutation.isPending,
    submitError: createTransferMutation.error,
    handleFormSubmit,
    setLastEditedField,
    transferableAccounts,
    toAccountOptions,
    fromAccount,
    toAccount,
    isCrossCurrency,
    titlePlaceholder,
  };
}
