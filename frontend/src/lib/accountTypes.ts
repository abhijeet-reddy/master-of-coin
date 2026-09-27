/**
 * Account type metadata shared by every page that lists accounts: display
 * label, the three-letter tag, and whether the type is a liability.
 */
import { AccountType } from '@/api/types';

export interface TypeMeta {
  label: string;
  tag: string;
  liability: boolean;
}

const TYPE_META: Record<AccountType, TypeMeta> = {
  [AccountType.CHECKING]: { label: 'Checking', tag: 'CHK', liability: false },
  [AccountType.SAVINGS]: { label: 'Savings', tag: 'SAV', liability: false },
  [AccountType.INVESTMENT]: { label: 'Investment', tag: 'INV', liability: false },
  [AccountType.CASH]: { label: 'Cash', tag: 'CSH', liability: false },
  [AccountType.GIFT_CARD]: { label: 'Gift card', tag: 'GFT', liability: false },
  [AccountType.CREDIT_CARD]: { label: 'Credit card', tag: 'CRD', liability: true },
  [AccountType.DEBT]: { label: 'Debt', tag: 'DBT', liability: true },
  // Not a server type; kept so stale data still renders.
  [AccountType.LOAN]: { label: 'Loan', tag: 'LN', liability: true },
};

/** Display order: assets first, then liabilities. */
export const TYPE_ORDER = Object.keys(TYPE_META) as AccountType[];

export function typeMeta(type: string): TypeMeta {
  return TYPE_META[type as AccountType] ?? { label: type, tag: type.slice(0, 3), liability: false };
}

/**
 * The types a user can pick (no LOAN). DEBT is excluded: it is the
 * system-managed pseudo-account for split debts, hidden from lists and
 * not editable, so a user-created one would vanish.
 */
export const SELECTABLE_TYPES: readonly AccountType[] = [
  AccountType.CHECKING,
  AccountType.SAVINGS,
  AccountType.CREDIT_CARD,
  AccountType.INVESTMENT,
  AccountType.CASH,
  AccountType.GIFT_CARD,
];

/** Types a bank (TrueLayer) can be linked to. */
export const BANK_TYPES: readonly AccountType[] = [
  AccountType.CHECKING,
  AccountType.SAVINGS,
  AccountType.CREDIT_CARD,
];

export const isBankType = (type: string) => BANK_TYPES.includes(type as AccountType);
export const isInvestmentType = (type: string) => (type as AccountType) === AccountType.INVESTMENT;
