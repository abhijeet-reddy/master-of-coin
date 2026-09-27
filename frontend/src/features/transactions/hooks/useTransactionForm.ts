import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { toApiError } from '@/api/client';
import { usePreferences } from '@/lib/preferences';
import {
  planSubmit,
  txFormDefaults,
  txFormSchema,
  TxFormMode,
  type TxFormSource,
  type TxFormValues,
} from '../forms/transactionForm';
import { useAccounts } from './useTxQueries';
import { useSaveTransaction } from './useTxMutations';

export type TxFormInput = Omit<TxFormSource, 'baseCurrency' | 'sourceCurrency'>;

const FIELDS = new Set(Object.keys(txFormSchema.shape));

/** Form state, defaults and submit for the create / edit / duplicate dialog. */
export function useTransactionForm(input: TxFormInput, onSaved: () => void) {
  const { prefs } = usePreferences();
  const accounts = useAccounts();
  const save = useSaveTransaction();
  const editing = input.mode === TxFormMode.Edit ? input.tx : undefined;
  const debtAccount = input.tx?.debt_metadata
    ? accounts.data?.find((a) => a.id === input.tx?.account_id)
    : undefined;

  const defaults = useMemo(
    () =>
      txFormDefaults({
        ...input,
        baseCurrency: prefs.default_currency,
        sourceCurrency: debtAccount ? String(debtAccount.currency) : undefined,
      }),
    // Defaults are read once per opening; the dialog is keyed per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const form = useForm<TxFormValues>({
    resolver: zodResolver(txFormSchema),
    defaultValues: defaults,
  });

  // A duplicated paid-by-others row keeps the payer's currency once accounts load.
  const debtCurrency = debtAccount ? String(debtAccount.currency) : null;
  useEffect(() => {
    if (debtCurrency && !form.getFieldState('payer_currency').isDirty)
      form.setValue('payer_currency', debtCurrency);
  }, [debtCurrency, form]);

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(planSubmit(values, editing));
      onSaved();
    } catch (err) {
      const e = toApiError(err);
      for (const [field, message] of Object.entries(e.fieldErrors)) {
        if (FIELDS.has(field)) form.setError(field as keyof TxFormValues, { message });
      }
      form.setError('root', { message: e.message });
    }
  });

  return { form, submit, saving: save.isPending, editing };
}
