/**
 * Pure view model for the people pages: who owes whom, sorting, and the
 * running debt balance rebuilt from a person's shared transactions.
 */
import type { Person, Transaction } from '@/api/types';
import { toNumber } from '@/lib/format';
import { localDay } from '@/features/transactions/lib/datetime';
import { round2 } from '@/lib/debtCurrency';

export { round2 };

export enum DebtDirection {
  OwesMe = 'owes-me',
  IOwe = 'i-owe',
  Settled = 'settled',
}

export interface DebtState {
  direction: DebtDirection;
  /** The size of the net debt, always positive. */
  amount: number;
  /** Signed net: positive means they owe me. */
  net: number;
}

/** Below a cent counts as settled. */
export function debtState(net: number | string | null | undefined): DebtState {
  const n = round2(toNumber(net ?? 0));
  if (Math.abs(n) < 0.005) return { direction: DebtDirection.Settled, amount: 0, net: 0 };
  return {
    direction: n > 0 ? DebtDirection.OwesMe : DebtDirection.IOwe,
    amount: Math.abs(n),
    net: n,
  };
}

/** Prefers the balance converted into the default currency; the server's raw sum otherwise. */
export const personNet = (p: Pick<Person, 'debt_summary'> & { balance?: { net: number } }) =>
  debtState(p.balance?.net ?? p.debt_summary?.net);

export const DEBT_LABEL: Record<DebtDirection, string> = {
  [DebtDirection.OwesMe]: 'Owes you',
  [DebtDirection.IOwe]: 'You owe',
  [DebtDirection.Settled]: 'Settled up',
};

export interface PeopleTotals {
  owedToMe: number;
  iOwe: number;
  net: number;
  /** People with a balance either way. */
  open: number;
}

/** Something with a debt: the server summary, and a converted balance when there is one. */
export type WithDebt = Pick<Person, 'debt_summary'> & { balance?: { net: number } };

/** Totals over the per-person nets (a person is on one side only). */
export function peopleTotals(people: readonly WithDebt[]): PeopleTotals {
  let owedToMe = 0;
  let iOwe = 0;
  let open = 0;
  for (const p of people) {
    const s = personNet(p);
    if (s.direction === DebtDirection.OwesMe) owedToMe += s.amount;
    if (s.direction === DebtDirection.IOwe) iOwe += s.amount;
    if (s.direction !== DebtDirection.Settled) open++;
  }
  return { owedToMe: round2(owedToMe), iOwe: round2(iOwe), net: round2(owedToMe - iOwe), open };
}

export const PEOPLE_SORTS = ['balance', 'name'] as const;
export type PeopleSort = (typeof PEOPLE_SORTS)[number];

/** `balance`: largest debt either way first, settled people last, then by name. */
export function sortPeople<T extends WithDebt & Pick<Person, 'name'>>(
  list: readonly T[],
  by: PeopleSort
): T[] {
  const byName = (a: T, b: T) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  if (by === 'name') return [...list].sort(byName);
  return [...list].sort((a, b) => personNet(b).amount - personNet(a).amount || byName(a, b));
}

export const PEOPLE_SHOWS = ['all', 'owes-me', 'i-owe', 'settled'] as const;
export type PeopleShow = (typeof PEOPLE_SHOWS)[number];

export function filterPeople<T extends Pick<Person, 'name' | 'email' | 'debt_summary'>>(
  list: readonly T[],
  show: PeopleShow,
  q: string
): T[] {
  const needle = q.trim().toLocaleLowerCase();
  return list.filter((p) => {
    if (show !== 'all' && (personNet(p).direction as string) !== show) return false;
    if (!needle) return true;
    return (
      p.name.toLocaleLowerCase().includes(needle) ||
      (p.email ?? '').toLocaleLowerCase().includes(needle)
    );
  });
}

/** How much this transaction moved the debt with the person (positive: they owe me more). */
export function splitAmountFor(tx: Pick<Transaction, 'splits'>, personId: string): number {
  return round2(
    (tx.splits ?? [])
      .filter((s) => s.person_id === personId)
      .reduce((sum, s) => sum + toNumber(s.amount), 0)
  );
}

export interface DebtChange {
  tx: Transaction;
  day: string;
  change: number;
  /** The balance right after this transaction. */
  balance: number;
}

export interface DebtHistory {
  /** One point per day with a change, oldest first, after a starting point. */
  points: { day: string; balance: number }[];
  /** Newest first. */
  changes: DebtChange[];
  /** The balance before the oldest loaded transaction. */
  opening: number;
}

/**
 * Walk backwards from the current net so the line ends where the server says
 * it is, even when older transactions were not loaded.
 */
export function debtHistory(
  txs: readonly Transaction[],
  personId: string,
  net: number,
  /** Converts a change into the currency `net` is in; identity by default. */
  toBase: (tx: Transaction, change: number) => number = (_tx, change) => change
): DebtHistory {
  const sorted = txs
    .map((tx) => ({
      tx,
      day: localDay(tx.date),
      change: round2(toBase(tx, splitAmountFor(tx, personId))),
    }))
    .filter((r) => r.change !== 0)
    .sort((a, b) => b.tx.date.localeCompare(a.tx.date));
  const changes: DebtChange[] = [];
  let after = round2(net);
  for (const r of sorted) {
    changes.push({ ...r, balance: after });
    after = round2(after - r.change);
  }
  const opening = after;
  const byDay = new Map<string, number>();
  for (let i = changes.length - 1; i >= 0; i--) byDay.set(changes[i].day, changes[i].balance);
  const days = [...byDay.entries()].map(([day, balance]) => ({ day, balance }));
  // The opening balance sits on the day before the first change, so every
  // point has its own day (the chart keys by it).
  const points = days.length ? [{ day: dayBefore(days[0].day), balance: opening }, ...days] : [];
  return { points, changes, opening };
}

/** `YYYY-MM-DD` of the calendar day before `day`. */
export function dayBefore(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d - 1));
  return t.toISOString().slice(0, 10);
}

/** Settling can clear the debt but not overshoot it. */
export const settleCap = (net: number) => round2(Math.abs(net));

/** Up to two initials for the avatar. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = [...parts[0]][0] ?? '';
  const last = parts.length > 1 ? ([...parts[parts.length - 1]][0] ?? '') : '';
  return (first + last).toLocaleUpperCase();
}

/** Accounts for settling: archived ones never appear (GET /accounts omits them; this is a second guard). */
export function settleAccounts<
  T extends { is_active: boolean; archived_at?: string | null; name: string },
>(list: readonly T[]): T[] {
  return list
    .filter((a) => a.is_active && !a.archived_at)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}
