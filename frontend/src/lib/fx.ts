/**
 * FX helpers. Rates come from GET /exchange-rates?base=X as
 * `conversion_rates[CUR] = how many CUR one unit of X buys`.
 */
import { toNumber, type Decimalish } from './format';

export interface RateTable {
  base: string;
  rates: Record<string, number>;
}

/** Rate to turn one unit of `from` into `to`, or null when either leg is unknown. */
export function rateBetween(
  from: string,
  to: string,
  table: RateTable | null | undefined
): number | null {
  if (from === to) return 1;
  if (!table) return null;
  const r = (c: string) => (c === table.base ? 1 : table.rates[c]);
  const rf = r(from);
  const rt = r(to);
  if (!rf || !rt || !Number.isFinite(rf) || !Number.isFinite(rt)) return null;
  return rt / rf;
}

/** Convert an amount; null (not 0) when the rate is missing so the UI can say so. */
export function convert(
  amount: Decimalish,
  from: string,
  to: string,
  table: RateTable | null | undefined
): number | null {
  const n = toNumber(amount);
  if (!Number.isFinite(n)) return null;
  const rate = rateBetween(from, to, table);
  return rate === null ? null : n * rate;
}

/**
 * Sum amounts in mixed currencies into `to`. `missing` lists currencies with
 * no rate; their amounts are left out of `total` rather than added unconverted.
 */
export function sumConverted(
  items: { amount: Decimalish; currency: string }[],
  to: string,
  table: RateTable | null | undefined
): { total: number; missing: string[] } {
  let total = 0;
  const missing = new Set<string>();
  for (const it of items) {
    const v = convert(it.amount, it.currency, to, table);
    if (v === null) missing.add(it.currency);
    else total += v;
  }
  return { total, missing: [...missing] };
}
