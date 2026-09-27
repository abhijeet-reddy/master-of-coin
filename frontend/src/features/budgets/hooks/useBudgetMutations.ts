/**
 * Budget and range writes. Every write refreshes whatever reads budget
 * spending: the budgets pages, the dashboard and the status strip.
 */
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  addBudgetRange,
  createBudget,
  deleteBudget,
  deleteBudgetRange,
  updateBudget,
  updateBudgetRange,
} from '@/api/budgets';
import { keys } from '@/api/keys';
import type { Budget, BudgetRange } from '@/api/types';
import { toast } from '@/ui';
import {
  budgetChanged,
  buildBudgetRequest,
  buildRangeFromBudget,
  rangeChanged,
  type BudgetFormValues,
} from '../forms/budgetForm';
import { buildRangeRequest, type RangeFormValues } from '../forms/rangeForm';

function refreshBudgets(qc: QueryClient) {
  for (const k of [keys.budgets.all, keys.dashboard]) void qc.invalidateQueries({ queryKey: k });
}

/**
 * Create: the budget, then its first range; if the range is refused the new
 * budget is removed again so a failed save leaves nothing behind.
 * Edit: name and filters on the budget, limit and period on the stored range
 * covering today (or a new range when none does).
 */
export function useSaveBudget(before: Budget | undefined, range: BudgetRange | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: BudgetFormValues): Promise<Budget> => {
      if (!before) {
        const created = await createBudget(buildBudgetRequest(v));
        try {
          await addBudgetRange(created.id, buildRangeFromBudget(v));
        } catch (err) {
          await deleteBudget(created.id).catch(() => undefined);
          throw err;
        }
        return created;
      }
      const req = buildRangeFromBudget(v, range);
      if (!range) await addBudgetRange(before.id, req);
      else if (rangeChanged(req, range)) await updateBudgetRange(before.id, range.id, req);
      return budgetChanged(v, before) ? updateBudget(before.id, buildBudgetRequest(v)) : before;
    },
    onSuccess: (saved) => {
      refreshBudgets(qc);
      toast.success(before ? 'Budget saved' : 'Budget created', { description: saved.name });
    },
  });
}

export function useDeleteBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (budget: Budget) => deleteBudget(budget.id),
    onSuccess: (_v, budget) => {
      qc.removeQueries({ queryKey: keys.budgets.detail(budget.id) });
      refreshBudgets(qc);
      toast.success('Budget deleted', { description: budget.name });
    },
  });
}

/** Add a range, or replace one. 409 when it overlaps another range. */
export function useSaveRange(budget: Budget, range: BudgetRange | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: RangeFormValues) =>
      range
        ? updateBudgetRange(budget.id, range.id, buildRangeRequest(v))
        : addBudgetRange(budget.id, buildRangeRequest(v)),
    onSuccess: () => {
      refreshBudgets(qc);
      toast.success(range ? 'Range saved' : 'Range added', { description: budget.name });
    },
  });
}

/** 422 for the budget's only range; the confirm dialog shows it inline. */
export function useDeleteRange(budget: Budget) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (range: BudgetRange) => deleteBudgetRange(budget.id, range.id),
    onSuccess: () => {
      refreshBudgets(qc);
      toast.success('Range deleted', { description: budget.name });
    },
  });
}
