import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type FieldValues, type Path, type UseFormReturn } from 'react-hook-form';
import { toApiError } from '@/api/client';
import type { Budget, BudgetRange } from '@/api/types';
import {
  BUDGET_FIELDS,
  budgetDefaults,
  budgetSchema,
  type BudgetFormValues,
} from '../forms/budgetForm';
import { RANGE_FIELDS, rangeDefaults, rangeSchema, type RangeFormValues } from '../forms/rangeForm';
import { formErrorTarget } from '../lib/budgetsModel';
import { useSaveBudget, useSaveRange } from './useBudgetMutations';

/** A failed save: 422s land on their field when one can be told, everything else on the form. */
function showError<T extends FieldValues>(
  form: UseFormReturn<T>,
  err: unknown,
  fields: readonly string[]
) {
  const target = formErrorTarget(toApiError(err), fields);
  if (target.field) {
    form.setError(target.field as Path<T>, { message: target.message }, { shouldFocus: true });
  } else {
    form.setError('root', { message: target.message });
  }
}

/** Create or edit a budget. `range` is the stored range covering today, when editing. */
export function useBudgetForm(
  budget: Budget | undefined,
  range: BudgetRange | undefined,
  onSaved: () => void
) {
  const save = useSaveBudget(budget, range);
  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: budgetDefaults(budget, range),
  });
  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values);
      onSaved();
    } catch (err) {
      showError(form, err, BUDGET_FIELDS);
    }
  });
  return { form, submit, saving: save.isPending, creating: !budget };
}

/** Add or edit one range of a budget. */
export function useRangeForm(
  budget: Budget,
  range: BudgetRange | undefined,
  prev: BudgetRange | undefined,
  onSaved: () => void
) {
  const save = useSaveRange(budget, range);
  const form = useForm<RangeFormValues>({
    resolver: zodResolver(rangeSchema),
    defaultValues: rangeDefaults(range, prev),
  });
  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values);
      onSaved();
    } catch (err) {
      showError(form, err, RANGE_FIELDS);
    }
  });
  return { form, submit, saving: save.isPending, creating: !range };
}
