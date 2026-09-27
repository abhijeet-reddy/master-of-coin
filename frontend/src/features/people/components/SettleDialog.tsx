import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toApiError } from '@/api/client';
import type { Person } from '@/api/types';
import { usePreferences } from '@/lib/preferences';
import {
  Button,
  ButtonVariant,
  ControlSize,
  Dialog,
  ErrorState,
  Field,
  Input,
  Select,
  Skeleton,
} from '@/ui';
import { settleDefaults, settleSchema, type SettleFormValues } from '../forms/settleForm';
import { useSettle } from '../hooks/usePeopleMutations';
import { useActiveAccounts } from '../hooks/usePeopleQueries';
import { DebtDirection, personNet, settleAccounts, settleCap } from '../lib/peopleModel';
import { Notice } from './Notice';
import styles from './People.module.css';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person: Person;
}

/** Record a payment that clears some or all of the debt, into or out of an account. */
export function SettleDialog({ open, onOpenChange, person }: Props) {
  const formId = useId();
  const { prefs, fmt } = usePreferences();
  const debt = personNet(person);
  const cap = settleCap(debt.net);
  const accountsQ = useActiveAccounts();
  const accounts = useMemo(() => settleAccounts(accountsQ.data ?? []), [accountsQ.data]);
  const schema = useMemo(() => settleSchema(cap), [cap]);
  const settle = useSettle(person);
  const form = useForm<SettleFormValues>({
    resolver: zodResolver(schema),
    defaultValues: settleDefaults(cap),
  });
  const { control, register, formState, setValue, getValues } = form;
  const errors = formState.errors;

  useEffect(() => {
    if (!getValues('account_id') && accounts[0]) setValue('account_id', accounts[0].id);
  }, [accounts, getValues, setValue]);

  const accountId = useWatch({ control, name: 'account_id' });
  const account = accounts.find((a) => a.id === accountId);
  const theyPay = debt.direction === DebtDirection.OwesMe;

  const submit = form.handleSubmit(async (v) => {
    try {
      await settle.mutateAsync(v);
      onOpenChange(false);
    } catch (err) {
      form.setError('root', { message: toApiError(err).message });
    }
  });

  const noAccounts = accountsQ.data !== undefined && accounts.length === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !settle.isPending && onOpenChange(o)}
      title={`Settle up with ${person.name}`}
      description={
        debt.direction === DebtDirection.Settled
          ? 'Nothing to settle.'
          : `${theyPay ? `${person.name} owes you` : `You owe ${person.name}`} ${fmt.money(debt.amount, prefs.default_currency)}.`
      }
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={settle.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            variant={ButtonVariant.Primary}
            loading={settle.isPending}
            disabled={cap === 0 || noAccounts || !accountsQ.data}
          >
            Record settlement
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={(e) => void submit(e)} noValidate>
        <Field
          label="Amount"
          required
          error={errors.amount?.message}
          hint={`Up to ${fmt.money(cap, prefs.default_currency)}, the full debt.`}
        >
          <Input numeric inputMode="decimal" autoComplete="off" {...register('amount')} />
        </Field>
        <div className={styles.cap}>
          <Button
            size={ControlSize.Sm}
            variant={ButtonVariant.Ghost}
            onClick={() => setValue('amount', cap.toFixed(2), { shouldValidate: true })}
          >
            Full amount
          </Button>
        </div>
        {accountsQ.error ? (
          <ErrorState
            compact
            error={accountsQ.error}
            title="Could not load accounts"
            onRetry={() => void accountsQ.refetch()}
          />
        ) : !accountsQ.data ? (
          <Skeleton height={36} />
        ) : noAccounts ? (
          <Notice>No active accounts. Add or unarchive an account to settle up.</Notice>
        ) : (
          <Field
            label={theyPay ? 'Paid into' : 'Paid from'}
            required
            error={errors.account_id?.message}
            hint="Archived accounts are not listed."
          >
            <Controller
              control={control}
              name="account_id"
              render={({ field }) => (
                <Select
                  value={field.value || undefined}
                  onValueChange={field.onChange}
                  placeholder="Choose an account"
                  options={accounts.map((a) => ({
                    value: a.id,
                    label: a.name,
                    hint: String(a.currency),
                  }))}
                />
              )}
            />
          </Field>
        )}
        <p className={styles.note}>
          {theyPay ? 'Records money received' : 'Records money paid'}
          {account ? ` ${theyPay ? 'into' : 'from'} ${account.name}` : ''}, titled "Debt settlement
          with {person.name}".
        </p>
        {errors.root?.message ? <Notice>{errors.root.message}</Notice> : null}
      </form>
    </Dialog>
  );
}
