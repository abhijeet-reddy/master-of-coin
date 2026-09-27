import { useId } from 'react';
import { Controller } from 'react-hook-form';
import type { Budget, BudgetRange } from '@/api/types';
import { Button, ButtonVariant, DatePicker, Dialog, Field, Input, Select } from '@/ui';
import { useRangeForm } from '../hooks/useBudgetForm';
import { PERIOD_OPTIONS } from '../forms/budgetForm';
import { Notice } from './Notice';
import styles from './Budgets.module.css';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: Budget;
  range?: BudgetRange;
  prev?: BudgetRange;
}

/** Add or edit one range. Ranges of a budget may not overlap; the server's 409 shows on the form. */
export function RangeFormDialog({ open, onOpenChange, budget, range, prev }: Props) {
  const formId = useId();
  const f = useRangeForm(budget, range, prev, () => onOpenChange(false));
  const { control, register, formState } = f.form;
  const errors = formState.errors;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !f.saving && onOpenChange(o)}
      title={f.creating ? 'Add range' : 'Edit range'}
      description={`${budget.name}: a limit and period from a start date, until an end date or open ended.`}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={f.saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant={ButtonVariant.Primary} loading={f.saving}>
            {f.creating ? 'Add range' : 'Save range'}
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={(e) => void f.submit(e)} noValidate>
        <div className={styles.two}>
          <Field label="Limit" required error={errors.limit_amount?.message}>
            <Input numeric inputMode="decimal" placeholder="250.00" {...register('limit_amount')} />
          </Field>
          <Field label="Period" required error={errors.period?.message}>
            <Controller
              control={control}
              name="period"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  options={PERIOD_OPTIONS}
                />
              )}
            />
          </Field>
        </div>
        <div className={styles.two}>
          <Field label="Starts" required error={errors.start_date?.message}>
            <Controller
              control={control}
              name="start_date"
              render={({ field }) => (
                <DatePicker
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? '')}
                  required
                />
              )}
            />
          </Field>
          <Field label="Ends" error={errors.end_date?.message} hint="Blank means open ended.">
            <Controller
              control={control}
              name="end_date"
              render={({ field }) => (
                <DatePicker
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Open ended"
                />
              )}
            />
          </Field>
        </div>
        {errors.root?.message ? <Notice>{errors.root.message}</Notice> : null}
      </form>
    </Dialog>
  );
}
