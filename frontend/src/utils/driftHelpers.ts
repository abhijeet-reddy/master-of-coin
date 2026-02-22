import type { DriftedItem, ExternalSplitInfo } from '@/types';

/** A matched split pair showing local vs external owed_share for the same person */
export interface SplitDiff {
  /** Display name for this person */
  name: string;
  /** Local owed_share (may be undefined if person only exists externally) */
  localOwed?: string;
  /** External owed_share (may be undefined if person only exists locally) */
  externalOwed?: string;
  /** Whether the owed_share actually differs between local and external */
  isDifferent: boolean;
}

/**
 * Build a list of split diffs by matching local_splits to external_splits
 * via external_user_id. Returns only entries where the owed_share differs,
 * or entries that exist on only one side.
 */
export const buildSplitDiffs = (item: DriftedItem): SplitDiff[] => {
  const externalByUserId = new Map<string, ExternalSplitInfo>();
  for (const ext of item.external_splits) {
    externalByUserId.set(ext.external_user_id, ext);
  }

  const seenExternalIds = new Set<string>();
  const diffs: SplitDiff[] = [];

  // Walk local splits, match to external
  for (const local of item.local_splits) {
    const ext = externalByUserId.get(local.external_user_id);
    seenExternalIds.add(local.external_user_id);

    const localOwed = normalizeAmount(local.owed_share);
    const externalOwed = ext ? normalizeAmount(ext.owed_share) : undefined;
    const isDifferent = externalOwed === undefined || localOwed !== externalOwed;

    diffs.push({
      name: local.person_name,
      localOwed: local.owed_share,
      externalOwed: ext?.owed_share,
      isDifferent,
    });
  }

  // External-only splits (not matched to any local split)
  for (const ext of item.external_splits) {
    if (!seenExternalIds.has(ext.external_user_id)) {
      diffs.push({
        name: `${ext.first_name} ${ext.last_name}`.trim(),
        localOwed: undefined,
        externalOwed: ext.owed_share,
        isDifferent: true,
      });
    }
  }

  return diffs;
};

/**
 * Get only the diffs where the split actually changed.
 */
export const getChangedSplitDiffs = (item: DriftedItem): SplitDiff[] => {
  return buildSplitDiffs(item).filter((d) => d.isDifferent);
};

/** Result of comparing local and external totals */
export interface TotalComparison {
  /** Whether the absolute amounts actually differ (not just sign convention) */
  isDifferent: boolean;
  /** Absolute local amount as formatted string */
  localTotal: string;
  /** Absolute external amount as formatted string */
  externalTotal: string;
}

/**
 * Compare local_amount and external_cost, normalizing sign conventions.
 * Local stores expenses as negative, external as positive — so we compare absolute values.
 */
export const compareTotals = (item: DriftedItem): TotalComparison => {
  const localNum = parseFloat(item.local_amount);
  const extNum = parseFloat(item.external_cost);
  const localAbs = isNaN(localNum) ? item.local_amount : Math.abs(localNum).toFixed(2);
  const extAbs = isNaN(extNum) ? item.external_cost : Math.abs(extNum).toFixed(2);
  return {
    isDifferent: localAbs !== extAbs,
    localTotal: localAbs,
    externalTotal: extAbs,
  };
};

/** Normalize an amount string for comparison (strip sign, trailing zeros after 2 decimals) */
const normalizeAmount = (amount: string): string => {
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;
  return Math.abs(num).toFixed(2);
};
