import { categoryColor } from './geometry';

export interface ShareItem {
  key: string;
  label: string;
  value: number;
}

export interface Slice extends ShareItem {
  color: string;
  share: number;
}

/**
 * Largest first; everything past `max - 1` folds into one "Other" slice so no
 * hue is ever generated past the fixed palette. Non-positive values are dropped.
 */
export function foldSlices(items: readonly ShareItem[], max = 7): Slice[] {
  const pos = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const total = pos.reduce((s, i) => s + i.value, 0);
  if (total === 0) return [];
  const head = pos.length > max ? pos.slice(0, max - 1) : pos;
  const rest = pos.length > max ? pos.slice(max - 1) : [];
  const slices: Slice[] = head.map((i, idx) => ({
    ...i,
    color: categoryColor(idx),
    share: i.value / total,
  }));
  if (rest.length) {
    const v = rest.reduce((s, i) => s + i.value, 0);
    slices.push({
      key: '__other',
      label: `Other (${rest.length})`,
      value: v,
      color: 'var(--viz-other)',
      share: v / total,
    });
  }
  return slices;
}
