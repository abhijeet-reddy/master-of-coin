import { useId } from 'react';
import { Controller, FormProvider, useFormContext, useWatch } from 'react-hook-form';
import { usePreferences } from '@/lib/preferences';
import {
  Button,
  ButtonVariant,
  Combobox,
  DatePicker,
  Dialog,
  Field,
  Input,
  Select,
  Switch,
  Textarea,
} from '@/ui';
import { hasParticipants, TxFormMode, type TxFormValues } from '../../forms/transactionForm';
import { useTransactionForm, type TxFormInput } from '../../hooks/useTransactionForm';
import { useAccounts, useCategories, usePeople } from '../../hooks/useTxQueries';
import { accountOptions, categoryOptions, currencyOptions, personOptions } from '../../lib/options';
import { AlertKind } from '../alertKind';
import { FormAlert } from '../FormAlert';
import { Segmented } from '../Segmented';
import { ParticipantFields } from './ParticipantFields';
import { SplitFields } from './SplitFields';
import styles from './Dialogs.module.css';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: TxFormInput;
}

const TITLES: Record<TxFormMode, [string, string]> = {
  [TxFormMode.Create]: ['Add transaction', 'Add transaction'],
  [TxFormMode.Edit]: ['Edit transaction', 'Save changes'],
  [TxFormMode.Duplicate]: ['Duplicate transaction', 'Add copy'],
};

const KINDS = [
  { value: 'expense', label: 'Money out' },
  { value: 'income', label: 'Money in' },
] as const;
const PAYERS = [
  { value: 'self', label: 'I paid' },
  { value: 'other', label: 'Someone else' },
] as const;

export function TransactionFormDialog({ open, onOpenChange, source }: Props) {
  const formId = useId();
  const { form, submit, saving, editing } = useTransactionForm(source, () => onOpenChange(false));
  const [title, action] = TITLES[source.mode];
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !saving && onOpenChange(o)}
      title={title}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant={ButtonVariant.Primary} loading={saving}>
            {action}
          </Button>
        </>
      }
    >
      <FormProvider {...form}>
        <form id={formId} className={styles.form} onSubmit={(e) => void submit(e)} noValidate>
          <TransactionFields editing={!!editing} />
          {form.formState.errors.root?.message ? (
            <FormAlert>{form.formState.errors.root.message}</FormAlert>
          ) : null}
        </form>
      </FormProvider>
    </Dialog>
  );
}

function TransactionFields({ editing }: { editing: boolean }) {
  const { prefs } = usePreferences();
  const accounts = useAccounts();
  const categories = useCategories();
  const people = usePeople();
  const { control, register, formState } = useFormContext<TxFormValues>();
  const values = useWatch({ control }) as TxFormValues;
  const errors = formState.errors;
  const other = values.payer === 'other';
  const participants = hasParticipants(values, editing);
  const account = accounts.data?.find((a) => a.id === values.account_id);
  const currency = other
    ? values.payer_currency
    : account
      ? String(account.currency)
      : prefs.default_currency;

  return (
    <>
      <div className={styles.two}>
        <Controller
          control={control}
          name="kind"
          render={({ field }) => (
            <Segmented
              legend="Type"
              value={field.value}
              options={KINDS}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="payer"
          render={({ field }) => (
            <Segmented
              legend="Who paid?"
              value={field.value}
              options={PAYERS}
              onChange={field.onChange}
              disabled={editing}
            />
          )}
        />
      </div>

      {other ? (
        <>
          <div className={styles.two}>
            <Field label="Paid by" required error={errors.payer_person_id?.message}>
              <Controller
                control={control}
                name="payer_person_id"
                render={({ field }) => (
                  <Combobox
                    value={field.value || null}
                    onChange={(v) => field.onChange(v ?? '')}
                    options={personOptions(people.data)}
                    placeholder="Pick a person"
                    searchPlaceholder="Search people"
                    disabled={editing}
                  />
                )}
              />
            </Field>
            <Field label="Currency" required>
              <Controller
                control={control}
                name="payer_currency"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    options={currencyOptions}
                    disabled={editing}
                  />
                )}
              />
            </Field>
          </div>
          <FormAlert kind={AlertKind.Info}>
            This won&apos;t affect any account balance. A debt will be tracked.
          </FormAlert>
        </>
      ) : (
        <Field label="Account" required error={errors.account_id?.message}>
          <Controller
            control={control}
            name="account_id"
            render={({ field }) => (
              <Combobox
                value={field.value || null}
                onChange={(v) => field.onChange(v ?? '')}
                options={accountOptions(accounts.data, { excludeDebt: true })}
                placeholder="Pick an account"
                searchPlaceholder="Search accounts"
              />
            )}
          />
        </Field>
      )}

      <Field label="Title" required error={errors.title?.message}>
        <Input autoComplete="off" placeholder="e.g. Groceries" {...register('title')} />
      </Field>

      <div className={styles.two}>
        <Field
          label="Amount"
          required
          error={errors.amount?.message}
          hint={participants ? 'Amount is auto-calculated from your share below.' : undefined}
        >
          <Input
            numeric
            inputMode="decimal"
            leading={currency}
            readOnly={participants}
            {...register('amount')}
          />
        </Field>
        <Field label="Category" error={errors.category_id?.message}>
          <Controller
            control={control}
            name="category_id"
            render={({ field }) => (
              <Combobox
                value={field.value || null}
                onChange={(v) => field.onChange(v ?? '')}
                options={categoryOptions(categories.data)}
                placeholder="Uncategorised"
                searchPlaceholder="Search categories"
                clearable
              />
            )}
          />
        </Field>
      </div>

      <div className={styles.two}>
        <Field label="Date" required error={errors.date?.message}>
          <Controller
            control={control}
            name="date"
            render={({ field }) => (
              <DatePicker
                value={field.value || null}
                onChange={(v) => field.onChange(v ?? '')}
                required
              />
            )}
          />
        </Field>
        <Field label="Time" required error={errors.time?.message} hint="Your local time">
          <Input type="time" {...register('time')} />
        </Field>
      </div>

      <Field label="Notes" error={errors.notes?.message}>
        <Textarea rows={2} {...register('notes')} />
      </Field>

      {!other ? (
        <Controller
          control={control}
          name="split_enabled"
          render={({ field }) => (
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
              label="Split with others"
            />
          )}
        />
      ) : null}
      {!other && values.split_enabled ? <SplitFields currency={currency} /> : null}
      {participants ? <ParticipantFields currency={currency} /> : null}
    </>
  );
}
