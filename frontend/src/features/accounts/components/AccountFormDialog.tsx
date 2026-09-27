import { useId } from 'react';
import { Controller } from 'react-hook-form';
import type { Account, AccountType } from '@/api/types';
import { CurrencyCode } from '@/api/types';
import { SELECTABLE_TYPES, typeMeta } from '@/lib/accountTypes';
import { Button, ButtonVariant, Dialog, Field, Input, Select, Switch, Textarea } from '@/ui';
import { ENV_OPTIONS } from '../forms/accountForm';
import { useAccountForm } from '../hooks/useAccountForm';
import { Notice } from './Notice';
import styles from './Accounts.module.css';

const TYPE_OPTIONS = SELECTABLE_TYPES.map((t) => ({ value: t, label: typeMeta(t).label }));
const CURRENCY_OPTIONS = Object.values(CurrencyCode).map((c) => ({ value: c as string, label: c }));

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account;
  type?: AccountType;
}

/** The account modal, for create and edit. */
export function AccountFormDialog({ open, onOpenChange, account, type }: Props) {
  const formId = useId();
  const f = useAccountForm(account, type, () => onOpenChange(false));
  const { control, register, formState } = f.form;
  const errors = formState.errors;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !f.saving && onOpenChange(o)}
      title={f.creating ? 'Add account' : `Edit ${account?.name ?? 'account'}`}
      description={
        f.creating ? 'A place money lives: a bank account, a card, cash, a brokerage.' : undefined
      }
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={f.saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant={ButtonVariant.Primary} loading={f.saving}>
            {f.creating ? 'Create account' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={(e) => void f.submit(e)} noValidate>
        <Field label="Name" required error={errors.name?.message}>
          <Input autoComplete="off" placeholder="e.g. Revolut Main" {...register('name')} />
        </Field>
        <div className={styles.two}>
          <Field label="Type" required error={errors.account_type?.message}>
            <Controller
              control={control}
              name="account_type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} options={TYPE_OPTIONS} />
              )}
            />
          </Field>
          <Field label="Currency" required error={errors.currency?.message}>
            <Controller
              control={control}
              name="currency"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  options={CURRENCY_OPTIONS}
                />
              )}
            />
          </Field>
        </div>
        {f.creating ? (
          <Field
            label="Opening balance"
            error={errors.initial_balance?.message}
            hint={f.liability ? 'Enter what you owe as a negative number.' : 'Blank means zero.'}
          >
            <Input
              numeric
              inputMode="decimal"
              placeholder="0.00"
              {...register('initial_balance')}
            />
          </Field>
        ) : null}
        <Field label="Notes" error={errors.notes?.message}>
          <Textarea rows={2} {...register('notes')} />
        </Field>
        {f.canConnect ? (
          <Controller
            control={control}
            name="connect"
            render={({ field }) => (
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                label="Connect Trading 212 now"
                description="Sync the portfolio value from your brokerage. You can also connect later."
              />
            )}
          />
        ) : null}
        {f.connecting ? (
          <div className={styles.section}>
            <div className={styles.two}>
              <Field label="API key" required error={errors.api_key?.message}>
                <Input type="password" autoComplete="off" {...register('api_key')} />
              </Field>
              <Field label="API secret" required error={errors.api_secret?.message}>
                <Input type="password" autoComplete="off" {...register('api_secret')} />
              </Field>
            </div>
            <Field label="Environment" required>
              <Controller
                control={control}
                name="environment"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    options={ENV_OPTIONS}
                  />
                )}
              />
            </Field>
          </div>
        ) : null}
        {errors.root?.message ? <Notice>{errors.root.message}</Notice> : null}
      </form>
    </Dialog>
  );
}
