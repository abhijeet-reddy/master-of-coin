import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toApiError } from '@/api/client';
import {
  buildTransferRequest,
  impliedRate,
  legGapPercent,
  transferSchema,
  type TransferFormValues,
} from '../forms/transferForm';
import { nowParts } from '../lib/datetime';
import { transferCategoryId } from '../lib/options';
import { useCreateTransfer } from './useTxMutations';
import { useAccounts, useCategories } from './useTxQueries';

/** Transfer between two of the user's accounts, same or cross currency. */
export function useTransferForm(fromAccountId: string | undefined, onSaved: () => void) {
  const accounts = useAccounts();
  const categories = useCategories();
  const create = useCreateTransfer();
  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      from_account_id: fromAccountId ?? '',
      to_account_id: '',
      amount: '',
      to_amount: '',
      different: false,
      cross: false,
      ...nowParts(),
      title: '',
      notes: '',
      category_id: transferCategoryId(categories.data),
    },
  });
  const [fromId, toId, amount, toAmount] = useWatch({
    control: form.control,
    name: ['from_account_id', 'to_account_id', 'amount', 'to_amount'],
  });
  const from = accounts.data?.find((a) => a.id === fromId);
  const to = accounts.data?.find((a) => a.id === toId);
  const cross = !!from && !!to && from.currency !== to.currency;

  useEffect(() => {
    form.setValue('cross', cross);
  }, [cross, form]);

  // Default to the "transfer" category once categories arrive, unless the user picked one.
  const transferCat = transferCategoryId(categories.data);
  useEffect(() => {
    if (transferCat && !form.getValues('category_id')) form.setValue('category_id', transferCat);
  }, [transferCat, form]);

  const submit = form.handleSubmit(async (values) => {
    try {
      await create.mutateAsync(buildTransferRequest(values));
      onSaved();
    } catch (err) {
      form.setError('root', { message: toApiError(err).message });
    }
  });

  return {
    form,
    submit,
    saving: create.isPending,
    from,
    to,
    cross,
    rate: cross ? impliedRate(amount, toAmount) : null,
    gap: cross ? null : legGapPercent(amount, toAmount),
    titlePlaceholder: to ? `Transfer to ${to.name}` : 'Transfer',
  };
}
