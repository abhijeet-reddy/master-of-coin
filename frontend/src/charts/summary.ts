/** Plain-language chart summaries for screen readers (and tests). */

export interface Extremes {
  min: number;
  max: number;
  minIndex: number;
  maxIndex: number;
  first: number;
  last: number;
}

export function extremes(values: readonly number[]): Extremes | null {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return null;
  let minIndex = 0;
  let maxIndex = 0;
  values.forEach((v, i) => {
    if (!Number.isFinite(v)) return;
    if (v < values[minIndex] || !Number.isFinite(values[minIndex])) minIndex = i;
    if (v > values[maxIndex] || !Number.isFinite(values[maxIndex])) maxIndex = i;
  });
  return {
    min: values[minIndex],
    max: values[maxIndex],
    minIndex,
    maxIndex,
    first: finite[0],
    last: finite[finite.length - 1],
  };
}

/** "Net worth from 1 Jan to 1 Sep: up 12% from €10,000 to €11,200. High €11,500 on 1 Aug, low ..." */
export function trendSummary(
  title: string,
  values: readonly number[],
  labels: readonly string[],
  format: (n: number) => string
): string {
  const e = extremes(values);
  if (!e || values.length === 0) return `${title}: no data.`;
  const range = labels.length ? ` from ${labels[0]} to ${labels[labels.length - 1]}` : '';
  const change = e.last - e.first;
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
  const pct =
    e.first !== 0 && change !== 0
      ? ` ${Math.abs(Math.round((change / Math.abs(e.first)) * 100))}%`
      : '';
  return (
    `${title}${range}: ${direction}${pct}, from ${format(e.first)} to ${format(e.last)}. ` +
    `High ${format(e.max)} (${labels[e.maxIndex] ?? ''}), low ${format(e.min)} (${labels[e.minIndex] ?? ''}).`
  );
}

/** "Spending by category, total €1,200: Groceries €400 (33%), Rent ..." */
export function shareSummary(
  title: string,
  items: ReadonlyArray<{ label: string; value: number }>,
  format: (n: number) => string
): string {
  const total = items.reduce((s, i) => s + Math.max(0, i.value), 0);
  if (items.length === 0 || total === 0) return `${title}: no data.`;
  const parts = items.map(
    (i) => `${i.label} ${format(i.value)} (${Math.round((i.value / total) * 100)}%)`
  );
  return `${title}, total ${format(total)}: ${parts.join(', ')}.`;
}
