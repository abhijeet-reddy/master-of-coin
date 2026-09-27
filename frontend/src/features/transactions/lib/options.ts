/** Picker options. Accounts come from the default GET /accounts, which already omits archived ones. */
import { AccountType, CurrencyCode, type Account, type Category, type Person } from '@/api/types';
import type { SelectOption } from '@/ui';

export function accountOptions(
  accounts: readonly Account[] | undefined,
  opts: { excludeIds?: readonly string[]; excludeDebt?: boolean } = {}
): SelectOption[] {
  return (accounts ?? [])
    .filter((a) => !(opts.excludeIds ?? []).includes(a.id))
    .filter((a) => !(opts.excludeDebt && a.account_type === AccountType.DEBT))
    .map((a) => ({ value: a.id, label: a.name, hint: String(a.currency) }));
}

/** Accounts a transaction can be recorded against directly (debt accounts are managed for you). */
export const spendingAccounts = (accounts: readonly Account[] | undefined) =>
  (accounts ?? []).filter((a) => a.account_type !== AccountType.DEBT);

export const categoryOptions = (categories: readonly Category[] | undefined): SelectOption[] =>
  [...(categories ?? [])]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ value: c.id, label: c.name }));

export const personOptions = (people: readonly Person[] | undefined): SelectOption[] =>
  [...(people ?? [])]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => ({ value: p.id, label: p.name }));

export const currencyOptions: SelectOption[] = Object.values(CurrencyCode).map((c) => ({
  value: c,
  label: c,
}));

/** The category named "transfer" (any case), which transfers default to. */
export const transferCategoryId = (categories: readonly Category[] | undefined) =>
  (categories ?? []).find((c) => c.name.trim().toLowerCase() === 'transfer')?.id ?? '';
