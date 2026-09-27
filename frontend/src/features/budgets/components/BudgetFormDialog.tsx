import { useId, useMemo } from 'react';
import { Controller } from 'react-hook-form';
import type { Budget, BudgetRange } from '@/api/types';
import {
  Button,
  ButtonVariant,
  Combobox,
  DatePicker,
  Dialog,
  ErrorState,
  Field,
  Input,
  Select,
  Skeleton,
  type SelectOption,
} from '@/ui';
import { ALL_SPENDING, ANY_ACCOUNT, PERIOD_OPTIONS } from '../forms/budgetForm';
import { useAccounts, useBudgetRanges, useCategories } from '../hooks/useBudgetQueries';
import { useBudgetForm } from '../hooks/useBudgetForm';
import { currentRange } from '../lib/budgetsModel';
import { Notice } from './Notice';
import styles from './Budgets.module.css';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget?: Budget;
}

/** The budget modal, for create and edit. Editing waits for the ranges so it edits the right one. */
export function BudgetFormDialog({ open, onOpenChange, budget }: Props) {
  const ranges = useBudgetRanges(budget?.id);
  if (budget && !ranges.data) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange} title={`Edit ${budget.name}`}>
        {ranges.error ? (
          <ErrorState
            compact
            error={ranges.error}
            title="Could not load this budget's ranges"
            onRetry={() => void ranges.refetch()}
          />
        ) : (
          <div aria-busy="true">
            <span className="sr-only">Loading</span>
            <Skeleton lines={6} height={14} />
          </div>
        )}
      </Dialog>
    );
  }
  const list = ranges.data ?? [];
  const range =
    list.find((r) => r.id === budget?.active_range?.id) ??
    (budget ? currentRange(list) : undefined);
  return <BudgetForm open={open} onOpenChange={onOpenChange} budget={budget} range={range} />;
}

function BudgetForm({ open, onOpenChange, budget, range }: Props & { range?: BudgetRange }) {
  const formId = useId();
  const f = useBudgetForm(budget, range, () => onOpenChange(false));
  const { control, register, formState } = f.form;
  const errors = formState.errors;
  const categories = useCategories();
  const accounts = useAccounts();

  const categoryOptions = useMemo<SelectOption[]>(() => {
    const opts: SelectOption[] = [{ value: ALL_SPENDING, label: 'All spending' }];
    for (const c of categories.data ?? []) opts.push({ value: c.id, label: c.name });
    const id = budget?.filters?.category_id;
    if (id && categories.data && !categories.data.some((c) => c.id === id))
      opts.push({ value: id, label: 'Deleted category' });
    return opts;
  }, [categories.data, budget]);

  const accountOptions = useMemo<SelectOption[]>(() => {
    const opts: SelectOption[] = [{ value: ANY_ACCOUNT, label: 'Any account' }];
    for (const a of accounts.data ?? [])
      opts.push({ value: a.id, label: a.name, hint: String(a.currency) });
    const id = budget?.filters?.account_id;
    // The picker never offers archived accounts, but keep one a budget already uses.
    if (id && accounts.data && !accounts.data.some((a) => a.id === id))
      opts.push({ value: id, label: 'Archived account' });
    return opts;
  }, [accounts.data, budget]);

  const editingRange = !f.creating && !!range;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !f.saving && onOpenChange(o)}
      title={f.creating ? 'Create budget' : 'Edit budget'}
      description={
        f.creating ? 'A spending limit for a period, on one category or on everything.' : undefined
      }
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={f.saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant={ButtonVariant.Primary} loading={f.saving}>
            {f.creating ? 'Create budget' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={(e) => void f.submit(e)} noValidate>
        <Field label="Name" required error={errors.name?.message}>
          <Input autoComplete="off" placeholder="e.g. Groceries" {...register('name')} />
        </Field>
        <div className={styles.two}>
          <Field
            label="Category"
            required
            error={errors.category?.message}
            hint="All spending leaves out categories excluded from analysis."
          >
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <Combobox
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? ALL_SPENDING)}
                  options={categoryOptions}
                  searchPlaceholder="Search categories"
                />
              )}
            />
          </Field>
          <Field label="Account" required error={errors.account?.message}>
            <Controller
              control={control}
              name="account"
              render={({ field }) => (
                <Combobox
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? ANY_ACCOUNT)}
                  options={accountOptions}
                  searchPlaceholder="Search accounts"
                />
              )}
            />
          </Field>
        </div>
        <div className={styles.two}>
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
          <Field label="Limit" required error={errors.limit_amount?.message}>
            <Input numeric inputMode="decimal" placeholder="250.00" {...register('limit_amount')} />
          </Field>
        </div>
        <Field
          label="Starts"
          required
          error={errors.start_date?.message}
          hint={
            editingRange
              ? 'Limit, period and start apply to the current range. Earlier ranges are on the budget page.'
              : f.creating
                ? undefined
                : 'No range covers today; saving adds one from this date.'
          }
        >
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
        {errors.root?.message ? <Notice>{errors.root.message}</Notice> : null}
      </form>
    </Dialog>
  );
}
