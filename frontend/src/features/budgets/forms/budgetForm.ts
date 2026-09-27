/** Budget create/edit form: schema, defaults and request builders. No notes: budgets do not have any. */
import { z } from 'zod';
import type {
  Budget,
  BudgetFilters,
  BudgetPeriod,
  BudgetRange,
  BudgetRangeRequest,
  CreateBudgetRequest,
} from '@/api/types';
import type { SelectOption } from '@/ui';
import { PERIODS, PERIOD_LABEL, todayUtc } from '../lib/budgetsModel';

export const NAME_MAX = 100;
/** Picker value for "no category filter": the budget counts all spending. */
export const ALL_SPENDING = '__all';
/** Picker value for "no account filter". */
export const ANY_ACCOUNT = '__any';

const positive = (v: string) => {
  const n = Number(v.trim());
  return v.trim() !== '' && Number.isFinite(n) && n >= 0.01;
};

export const limitField = z
  .string()
  .refine(positive, 'Enter a limit above zero, e.g. 250 or 99.50');

export const periodField = z.enum(PERIODS as [BudgetPeriod, ...BudgetPeriod[]], {
  error: 'Pick a period',
});

export const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date');

export const budgetSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(NAME_MAX, `Keep the name under ${NAME_MAX} characters`),
  category: z.string(),
  account: z.string(),
  period: periodField,
  limit_amount: limitField,
  start_date: dateField,
});

export type BudgetFormValues = z.infer<typeof budgetSchema>;
export const BUDGET_FIELDS = ['name', 'period', 'limit_amount', 'start_date'] as const;

/** First of this month (UTC), where a new monthly budget usually starts. */
export const monthStart = (today: string = todayUtc()) => `${today.slice(0, 7)}-01`;

/**
 * Edit fills the limit and period from the stored range covering today
 * (`range`), falling back to the current period window.
 */
export function budgetDefaults(budget?: Budget, range?: BudgetRange): BudgetFormValues {
  const r = range ?? budget?.active_range ?? undefined;
  return {
    name: budget?.name ?? '',
    category: budget?.filters?.category_id ?? ALL_SPENDING,
    account: budget?.filters?.account_id ?? ANY_ACCOUNT,
    period: r?.period ?? 'MONTHLY',
    limit_amount: r ? String(Number(r.limit_amount)) : '',
    start_date: r?.start_date ?? monthStart(),
  };
}

export function buildFilters(v: BudgetFormValues): BudgetFilters {
  const f: BudgetFilters = {};
  if (v.category && v.category !== ALL_SPENDING) f.category_id = v.category;
  if (v.account && v.account !== ANY_ACCOUNT) f.account_id = v.account;
  return f;
}

export function buildBudgetRequest(v: BudgetFormValues): CreateBudgetRequest {
  return { name: v.name.trim(), filters: buildFilters(v) };
}

/** The range part. Editing keeps the stored range's end date. */
export function buildRangeFromBudget(v: BudgetFormValues, keep?: BudgetRange): BudgetRangeRequest {
  return {
    limit_amount: Number(v.limit_amount.trim()),
    period: v.period,
    start_date: v.start_date,
    end_date: keep?.end_date ?? null,
  };
}

const sameFilters = (a: BudgetFilters, b: BudgetFilters) =>
  (a.category_id ?? null) === (b.category_id ?? null) &&
  (a.account_id ?? null) === (b.account_id ?? null);

/** True when name or filters changed, so PUT /budgets/:id is needed. */
export function budgetChanged(v: BudgetFormValues, before: Budget): boolean {
  return v.name.trim() !== before.name || !sameFilters(buildFilters(v), before.filters ?? {});
}

/** True when the range fields differ from the stored range. */
export function rangeChanged(req: BudgetRangeRequest, before: BudgetRange): boolean {
  return (
    req.limit_amount !== Number(before.limit_amount) ||
    req.period !== before.period ||
    req.start_date !== before.start_date ||
    (req.end_date ?? null) !== (before.end_date ?? null)
  );
}

export const PERIOD_OPTIONS: SelectOption<BudgetPeriod>[] = PERIODS.map((p) => ({
  value: p,
  label: PERIOD_LABEL[p],
}));
