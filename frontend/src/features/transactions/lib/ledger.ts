/**
 * Pure view model for the ledger: rows enriched with account and category,
 * grouped by LOCAL calendar day, each day with a subtotal in the user's
 * default currency.
 */
import type { Account, Category, Person, Transaction, TransactionSplit } from '@/api/types';
import { toNumber } from '@/lib/format';
import { convert, sumConverted, type RateTable } from '@/lib/fx';
import { localDay } from './datetime';

export interface LedgerRow {
  tx: Transaction;
  amount: number;
  /** The account's currency; the default currency when the account is unknown. */
  currency: string;
  /** In the default currency; null when native is already the default or no rate exists. */
  converted: number | null;
  accountName: string;
  category: Category | null;
  split: { name: string; count: number; othersTotal: number } | null;
  transfer: { direction: 'to' | 'from'; account: string } | null;
  paidBy: string | null;
  hasNote: boolean;
}

export interface DayGroup {
  /** Local `YYYY-MM-DD`. */
  day: string;
  rows: LedgerRow[];
  /** Sum of the day in the default currency (rows without a rate are left out). */
  subtotal: number;
  /** Currencies with no rate, so the subtotal can say it is partial. */
  missing: string[];
}

export interface LedgerContext {
  accounts: ReadonlyMap<string, Account>;
  categories: ReadonlyMap<string, Category>;
  base: string;
  rates: RateTable | null;
  /** Split rows from the API carry only `person_id`; names come from here. */
  people?: ReadonlyMap<string, Person>;
}

export const byId = <T extends { id: string }>(items: readonly T[] | undefined): Map<string, T> =>
  new Map((items ?? []).map((i) => [i.id, i]));

/** A split's person name: the API's own field when present, else the people list. */
export function splitPersonName(
  split: Pick<TransactionSplit, 'person_id' | 'person_name'>,
  people: ReadonlyMap<string, Pick<Person, 'name'>> | undefined
): string {
  return split.person_name ?? people?.get(split.person_id)?.name ?? 'Someone';
}

export function ledgerRow(tx: Transaction, ctx: LedgerContext): LedgerRow {
  const account = ctx.accounts.get(tx.account_id);
  const currency = account ? String(account.currency) : ctx.base;
  const amount = toNumber(tx.amount);
  const splits = tx.splits ?? [];
  return {
    tx,
    amount,
    currency,
    converted: currency === ctx.base ? null : convert(amount, currency, ctx.base, ctx.rates),
    accountName: tx.debt_metadata
      ? `Paid by ${tx.debt_metadata.payer_person_name}`
      : (account?.name ?? 'Unknown account'),
    category: tx.category_id ? (ctx.categories.get(tx.category_id) ?? null) : null,
    split: splits.length
      ? {
          name: splitPersonName(splits[0], ctx.people),
          count: splits.length,
          othersTotal: splits.reduce((s, x) => s + Math.abs(toNumber(x.amount)), 0),
        }
      : null,
    transfer: tx.transfer_info
      ? { direction: amount < 0 ? 'to' : 'from', account: tx.transfer_info.linked_account_name }
      : null,
    paidBy: tx.debt_metadata?.payer_person_name ?? null,
    hasNote: !!tx.notes?.trim(),
  };
}

/** Group in server order (newest first); days keep first-seen order. */
export function groupByDay(txs: readonly Transaction[], ctx: LedgerContext): DayGroup[] {
  const groups = new Map<string, LedgerRow[]>();
  for (const tx of txs) {
    const day = localDay(tx.date);
    const list = groups.get(day) ?? [];
    list.push(ledgerRow(tx, ctx));
    groups.set(day, list);
  }
  return [...groups.entries()].map(([day, rows]) => {
    const { total, missing } = sumConverted(
      rows.map((r) => ({ amount: r.amount, currency: r.currency })),
      ctx.base,
      ctx.rates
    );
    return { day, rows, subtotal: round2(total), missing };
  });
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Your share of a split: the absolute amount less everyone else's shares, floored at 0. */
export function userShare(amount: number, splitAmounts: readonly (string | number)[]): number {
  const others = splitAmounts.reduce<number>((s, a) => s + Math.abs(toNumber(a)), 0);
  return round2(Math.max(Math.abs(amount) - others, 0));
}

/**
 * Split `total` equally between the user and `people` others, in cents.
 * Returns the others' shares; remainder pennies go to the others in order
 * (deterministic, unlike v1's random assignment), so the user never pays more
 * than an equal share.
 */
export function equalSplits(total: number, people: number): string[] {
  if (people <= 0) return [];
  if (!(total > 0)) return Array.from({ length: people }, () => '0.00');
  const cents = Math.round(total * 100);
  const each = Math.floor(cents / (people + 1));
  let rest = cents - each * (people + 1);
  return Array.from({ length: people }, () => {
    const extra = rest > 0 ? 1 : 0;
    rest -= extra;
    return ((each + extra) / 100).toFixed(2);
  });
}

/** Difference between the two legs of a transfer; null when they match to the cent. */
export function transferDelta(own: string, linked: string): number | null {
  const d = round2(Math.abs(toNumber(own)) - Math.abs(toNumber(linked)));
  return Math.abs(d) >= 0.005 ? d : null;
}

export interface AccountFlows {
  in: number;
  /** Negative (or zero). */
  out: number;
  net: number;
  count: number;
}

/** Money in and out across rows of ONE account, in that account's currency. */
export function accountFlows(rows: readonly Pick<Transaction, 'amount'>[]): AccountFlows {
  let inflow = 0;
  let outflow = 0;
  for (const r of rows) {
    const n = toNumber(r.amount);
    if (!Number.isFinite(n)) continue;
    if (n > 0) inflow += n;
    else outflow += n;
  }
  return { in: inflow, out: outflow, net: inflow + outflow, count: rows.length };
}

export interface ScopedFlows extends AccountFlows {
  /** Currencies with no rate; their rows are left out of the totals. */
  missing: string[];
}

/**
 * Money in and out across rows from any accounts, converted into the default currency. Rows
 * whose currency has no rate are left out and their currency listed in `missing`.
 */
export function scopedFlows(
  rows: readonly Pick<Transaction, 'amount' | 'account_id'>[],
  ctx: Pick<LedgerContext, 'accounts' | 'base' | 'rates'>
): ScopedFlows {
  let inflow = 0;
  let outflow = 0;
  const missing = new Set<string>();
  for (const r of rows) {
    const account = ctx.accounts.get(r.account_id);
    const currency = account ? String(account.currency) : ctx.base;
    const n = convert(r.amount, currency, ctx.base, ctx.rates);
    if (n === null || !Number.isFinite(n)) {
      missing.add(currency);
      continue;
    }
    if (n > 0) inflow += n;
    else outflow += n;
  }
  return {
    in: round2(inflow),
    out: round2(outflow),
    net: round2(inflow + outflow),
    count: rows.length,
    missing: [...missing].sort(),
  };
}
