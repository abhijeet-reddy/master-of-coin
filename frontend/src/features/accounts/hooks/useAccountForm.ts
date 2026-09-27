import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { toApiError } from '@/api/client';
import { AccountType, type Account } from '@/api/types';
import { usePreferences } from '@/lib/preferences';
import { accountDefaults, accountSchema, type AccountFormValues } from '../forms/accountForm';
import { useSaveAccount } from './useAccountMutations';

/** Create or edit an account; on create an investment account can connect Trading 212 in the same step. */
export function useAccountForm(
  account: Account | undefined,
  type: AccountType | undefined,
  onSaved: () => void
) {
  const { prefs } = usePreferences();
  const save = useSaveAccount(account);
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: accountDefaults(account, prefs.default_currency, type),
  });
  const [accountType, connect] = useWatch({
    control: form.control,
    name: ['account_type', 'connect'],
  });
  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values);
      onSaved();
    } catch (err) {
      form.setError('root', { message: toApiError(err).message });
    }
  });
  const creating = !account;
  return {
    form,
    submit,
    saving: save.isPending,
    creating,
    /** Trading 212 can be connected while creating an investment account. */
    canConnect: creating && accountType === AccountType.INVESTMENT,
    connecting: creating && accountType === AccountType.INVESTMENT && connect,
    liability: accountType === AccountType.CREDIT_CARD || accountType === AccountType.DEBT,
  };
}
