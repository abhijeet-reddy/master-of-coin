/** Pure SVG geometry helpers for the charts. */

/**
 * A bar with a rounded data-end (4px) and a square baseline.
 * `y` is the top edge in SVG space; `negative` rounds the bottom instead.
 */
export function barPath(
  x: number,
  y: number,
  w: number,
  h: number,
  negative = false,
  radius = 4
): string {
  if (w <= 0 || h <= 0) return '';
  const r = Math.min(radius, w / 2, h);
  if (!negative) {
    return [
      `M${x},${y + h}`,
      `V${y + r}`,
      `Q${x},${y} ${x + r},${y}`,
      `H${x + w - r}`,
      `Q${x + w},${y} ${x + w},${y + r}`,
      `V${y + h}`,
      'Z',
    ].join('');
  }
  return [
    `M${x},${y}`,
    `V${y + h - r}`,
    `Q${x},${y + h} ${x + r},${y + h}`,
    `H${x + w - r}`,
    `Q${x + w},${y + h} ${x + w},${y + h - r}`,
    `V${y}`,
    'Z',
  ].join('');
}

/** Index of the value in a sorted numeric array closest to `target`. */
export function nearestIndex(positions: readonly number[], target: number): number {
  if (positions.length === 0) return -1;
  let best = 0;
  let bestDist = Infinity;
  positions.forEach((p, i) => {
    const d = Math.abs(p - target);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

/** Categorical colour for slot i (fixed order, never cycled); past 8 is "Other". */
export function categoryColor(i: number): string {
  return i < 8 ? `var(--viz-cat-${i + 1})` : 'var(--viz-other)';
}

/**
 * Which label indices to draw so labels never collide: every `step`th plus the last.
 * The last label is end-anchored, so it needs half a label more room from its neighbour.
 */
export function labelIndices(count: number, width: number, minGap = 64): number[] {
  if (count <= 0) return [];
  const max = Math.max(2, Math.floor(width / minGap));
  const step = Math.max(1, Math.ceil(count / max));
  const out: number[] = [];
  for (let i = 0; i < count; i += step) out.push(i);
  const last = count - 1;
  if (out[out.length - 1] !== last) {
    const pitch = width / Math.max(1, count - 1);
    if (
      out.length > 1 &&
      (last - out[out.length - 1] < step / 2 + 0.5 ||
        (last - out[out.length - 1]) * pitch < minGap * 1.5)
    )
      out.pop();
    out.push(last);
  }
  return out;
}
