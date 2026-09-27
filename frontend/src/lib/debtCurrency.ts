/**
 * Debts per currency. The server's debt summary adds split amounts raw, whatever currency each
 * account is in, so a USD split and a EUR split add up as if they were one currency. Here the
 * splits are regrouped by their account's currency and converted into the user's default.
 */
import type { Person, Transaction } from '@/api/types';
import { convert, type RateTable } from '@/lib/fx';
import { toNumber } from '@/lib/format';

/** Round to cents. */
export const round2 = (n: number) => Math.round(n * 100) / 100;

export interface NativeAmount {
  currency: string;
  amount: number;
}

export interface DebtBalance {
  /** Signed, in the default currency: positive means they owe me. */
  net: number;
  /** The same debt in the currencies it was made in, largest first. Settled currencies are left out. */
  natives: NativeAmount[];
  /** Currencies with no rate; left out of `net` rather than added unconverted. */
  missing: string[];
  /** More than one currency, or one that is not the default. */
  foreign: boolean;
}

/** person id to currency to signed split total, from transactions with splits. */
export function netsByCurrency(
  txs: readonly Pick<Transaction, 'account_id' | 'splits'>[],
  currencyOf: (accountId: string) => string | undefined
): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const tx of txs) {
    const cur = currencyOf(tx.account_id);
    if (!cur) continue;
    for (const s of tx.splits ?? []) {
      const byCur = out.get(s.person_id) ?? new Map<string, number>();
      byCur.set(cur, (byCur.get(cur) ?? 0) + toNumber(s.amount));
      out.set(s.person_id, byCur);
    }
  }
  return out;
}

/**
 * One person's balance in the default currency. Whatever the loaded splits do not explain
 * (older rows past the page cap) is taken to be in the default currency, so a person whose
 * splits are all in it gets exactly the server's figure.
 */
export function balanceOf(
  serverNet: number | string | null | undefined,
  byCurrency: ReadonlyMap<string, number> | undefined,
  base: string,
  table: RateTable | null | undefined
): DebtBalance {
  const buckets = new Map(byCurrency ?? []);
  const loaded = [...buckets.values()].reduce((a, b) => a + b, 0);
  const residual = round2(toNumber(serverNet ?? 0) - loaded);
  if (Math.abs(residual) >= 0.005) buckets.set(base, (buckets.get(base) ?? 0) + residual);

  const natives: NativeAmount[] = [];
  const missing: string[] = [];
  let net = 0;
  for (const [currency, raw] of buckets) {
    const amount = round2(raw);
    if (Math.abs(amount) < 0.005) continue;
    natives.push({ currency, amount });
    const v = convert(amount, currency, base, table);
    if (v === null) missing.push(currency);
    else net += v;
  }
  natives.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  const foreign = natives.some((n) => n.currency !== base);
  return { net: round2(net), natives, missing, foreign };
}

export type PersonWithBalance = Person & { balance?: DebtBalance };

/** Attach a converted balance to every person. */
export function withBalances(
  people: readonly Person[],
  nets: ReadonlyMap<string, ReadonlyMap<string, number>>,
  base: string,
  table: RateTable | null | undefined
): PersonWithBalance[] {
  return people.map((p) => ({
    ...p,
    balance: balanceOf(p.debt_summary?.net, nets.get(p.id), base, table),
  }));
}

export interface DebtTotals {
  /** Sum of positive balances, in the default currency. */
  owedToMe: number;
  /** Sum of negative balances as a positive number, in the default currency. */
  iOwe: number;
  /** Currencies left out for want of a rate. */
  missing: string[];
}

/** Totals across people from their converted balances, never from the server's raw sums. */
export function debtTotals(balances: readonly (DebtBalance | undefined)[]): DebtTotals {
  let owedToMe = 0;
  let iOwe = 0;
  const missing = new Set<string>();
  for (const b of balances) {
    if (!b) continue;
    if (b.net > 0) owedToMe += b.net;
    else iOwe -= b.net;
    for (const m of b.missing) missing.add(m);
  }
  return { owedToMe: round2(owedToMe), iOwe: round2(iOwe), missing: [...missing].sort() };
}
