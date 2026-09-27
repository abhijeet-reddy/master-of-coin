/** Pure helpers for a drift report: split differences and totals, ignoring sign conventions. */
import type { DriftedItem, DriftReport, ExternalSplitInfo } from '@/api/types';

export interface SplitDiff {
  name: string;
  /** Undefined when the person only exists on the provider. */
  localOwed?: string;
  /** Undefined when the person only exists locally. */
  externalOwed?: string;
  isDifferent: boolean;
}

/** Absolute value to 2 decimals, so -12.5 and 12.50 compare equal. */
export function normalizeAmount(amount: string): string {
  const n = parseFloat(amount);
  return Number.isNaN(n) ? amount : Math.abs(n).toFixed(2);
}

/** Pair local and provider splits by external user id; provider-only people come last. */
export function buildSplitDiffs(item: DriftedItem): SplitDiff[] {
  const byUser = new Map<string, ExternalSplitInfo>(
    item.external_splits.map((e) => [e.external_user_id, e])
  );
  const seen = new Set<string>();
  const diffs: SplitDiff[] = item.local_splits.map((local) => {
    seen.add(local.external_user_id);
    const ext = byUser.get(local.external_user_id);
    return {
      name: local.person_name,
      localOwed: local.owed_share,
      externalOwed: ext?.owed_share,
      isDifferent: !ext || normalizeAmount(local.owed_share) !== normalizeAmount(ext.owed_share),
    };
  });
  for (const ext of item.external_splits) {
    if (seen.has(ext.external_user_id)) continue;
    diffs.push({
      name: `${ext.first_name} ${ext.last_name}`.trim(),
      externalOwed: ext.owed_share,
      isDifferent: true,
    });
  }
  return diffs;
}

export const changedSplitDiffs = (item: DriftedItem): SplitDiff[] =>
  buildSplitDiffs(item).filter((d) => d.isDifferent);

export interface TotalComparison {
  isDifferent: boolean;
  localTotal: string;
  externalTotal: string;
}

/** Local stores expenses as negative, the provider as positive: compare absolute values. */
export function compareTotals(item: DriftedItem): TotalComparison {
  const localTotal = normalizeAmount(item.local_amount);
  const externalTotal = normalizeAmount(item.external_cost);
  return { isDifferent: localTotal !== externalTotal, localTotal, externalTotal };
}

export const hasSyncable = (r: DriftReport): boolean =>
  r.drifted.length + r.missing_on_external.length + r.missing_on_local.length > 0;

const PROVIDERS: Record<string, string> = { splitwise: 'Splitwise', splitpro: 'SplitPro' };

/** Display name of a split provider; "the provider" when the report did not say. */
export const providerName = (p?: string | null): string =>
  p ? (PROVIDERS[p.toLowerCase()] ?? p) : 'the provider';
