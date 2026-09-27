import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toApiError } from '@/api/client';
import type { Account } from '@/api/types';
import { brokerSchema, BrokerEnv, type BrokerFormValues } from '../forms/accountForm';
import { useConnectBank, useConnectBroker } from './useAccountMutations';

/** Connect either provider: TrueLayer by redirect, Trading 212 by API key. */
export function useConnectForm(account: Account | undefined, onDone: () => void) {
  const bank = useConnectBank();
  const broker = useConnectBroker();
  const form = useForm<BrokerFormValues>({
    resolver: zodResolver(brokerSchema),
    defaultValues: { api_key: '', api_secret: '', environment: BrokerEnv.Live },
  });
  const submitBroker = form.handleSubmit(async (values) => {
    if (!account) return;
    try {
      await broker.mutateAsync({ account, values });
      onDone();
    } catch (err) {
      form.setError('root', { message: toApiError(err).message });
    }
  });
  return {
    form,
    submitBroker,
    connectBank: () => account && bank.mutate(account.id),
    pending: bank.isPending || broker.isPending || bank.isSuccess,
  };
}
