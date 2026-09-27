import { useId } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import {
  Button,
  ButtonVariant,
  Combobox,
  DatePicker,
  Dialog,
  Field,
  Input,
  Switch,
  Textarea,
} from '@/ui';
import { useTransferForm } from '../../hooks/useTransferForm';
import { useAccounts, useCategories } from '../../hooks/useTxQueries';
import { accountOptions, categoryOptions } from '../../lib/options';
import { AlertKind } from '../alertKind';
import { FormAlert } from '../FormAlert';
import styles from './Dialogs.module.css';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromAccountId?: string;
}

/** Move money between two accounts. Debt accounts are not offered. */
export function TransferDialog({ open, onOpenChange, fromAccountId }: Props) {
  const formId = useId();
  const t = useTransferForm(fromAccountId, () => onOpenChange(false));
  const accounts = useAccounts();
  const categories = useCategories();
  const { control, register, formState } = t.form;
  const errors = formState.errors;
  const [fromId, different] = useWatch({ control, name: ['from_account_id', 'different'] });
  const fromCur = t.from ? String(t.from.currency) : undefined;
  const toCur = t.to ? String(t.to.currency) : undefined;
  const showReceived = t.cross || different;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !t.saving && onOpenChange(o)}
      title="Transfer"
      description="Move money between two of your accounts."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={t.saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant={ButtonVariant.Primary} loading={t.saving}>
            Create transfer
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={(e) => void t.submit(e)} noValidate>
        <div className={styles.two}>
          <Field label="From" required error={errors.from_account_id?.message}>
            <Controller
              control={control}
              name="from_account_id"
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
          <Field label="To" required error={errors.to_account_id?.message}>
            <Controller
              control={control}
              name="to_account_id"
              render={({ field }) => (
                <Combobox
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? '')}
                  options={accountOptions(accounts.data, {
                    excludeDebt: true,
                    excludeIds: [fromId],
                  })}
                  placeholder="Pick an account"
                  searchPlaceholder="Search accounts"
                />
              )}
            />
          </Field>
        </div>

        <div className={styles.two}>
          <Field
            label={showReceived ? 'Amount sent' : 'Amount'}
            required
            error={errors.amount?.message}
          >
            <Input numeric inputMode="decimal" leading={fromCur} {...register('amount')} />
          </Field>
          {showReceived ? (
            <Field
              label="Amount received"
              required
              error={errors.to_amount?.message}
              hint={t.rate ? `1 ${fromCur} = ${t.rate.toFixed(4)} ${toCur}` : undefined}
            >
              <Input numeric inputMode="decimal" leading={toCur} {...register('to_amount')} />
            </Field>
          ) : null}
        </div>

        {!t.cross ? (
          <Controller
            control={control}
            name="different"
            render={({ field }) => (
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                label="Different amount received"
                description="The amount that lands on the destination, if it differs from the amount sent (e.g. a discount or fee)."
              />
            )}
          />
        ) : (
          <FormAlert kind={AlertKind.Info}>
            These accounts use different currencies. Enter what arrived; the rate is worked out for
            you.
          </FormAlert>
        )}
        {t.gap ? (
          <FormAlert kind={AlertKind.Warn}>
            The two amounts differ by {t.gap}%. Check that is right before saving.
          </FormAlert>
        ) : null}

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

        <Field label="Title" error={errors.title?.message}>
          <Input autoComplete="off" placeholder={t.titlePlaceholder} {...register('title')} />
        </Field>
        <Field label="Category">
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
        <Field label="Notes" error={errors.notes?.message}>
          <Textarea rows={2} {...register('notes')} />
        </Field>
        {errors.root?.message ? <FormAlert>{errors.root.message}</FormAlert> : null}
      </form>
    </Dialog>
  );
}
