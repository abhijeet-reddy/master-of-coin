import type { ScaleLinear } from 'd3-scale';
import { labelIndices } from './geometry';
import styles from './Chart.module.css';

/** Recessive hairline grid with left-aligned value ticks. */
export function YGrid({
  y,
  width,
  left,
  format,
  ticks = 4,
}: {
  y: ScaleLinear<number, number>;
  width: number;
  left: number;
  format: (n: number) => string;
  ticks?: number;
}) {
  return (
    <g aria-hidden>
      {y.ticks(ticks).map((t) => (
        <g key={t} transform={`translate(0,${Math.round(y(t)) + 0.5})`}>
          <line x1={left} x2={width} className={t === 0 ? styles.baseline : styles.grid} />
          <text x={left - 8} dy="0.32em" textAnchor="end" className={styles.tick}>
            {format(t)}
          </text>
        </g>
      ))}
    </g>
  );
}

/** Room one label needs at the 10.5px mono tick size, so long labels thin out sooner. */
const labelGap = (labels: string[]) =>
  Math.max(64, Math.max(0, ...labels.map((l) => l.length)) * 6.5 + 16);

/** Evenly thinned category labels under the plot. */
export function XLabels({
  labels,
  xs,
  top,
  width,
}: {
  labels: string[];
  xs: number[];
  top: number;
  width: number;
}) {
  // Space labels over the plotted span, not the whole svg: the y-axis gutter holds no labels.
  const span = xs.length > 1 ? Math.abs(xs[xs.length - 1] - xs[0]) : width;
  return (
    <g aria-hidden>
      {labelIndices(labels.length, span, labelGap(labels)).map((i) => {
        const anchor = xs[i] < 28 ? 'start' : width - xs[i] < 28 ? 'end' : 'middle';
        return (
          <text key={i} x={xs[i]} y={top + 16} textAnchor={anchor} className={styles.tick}>
            {labels[i]}
          </text>
        );
      })}
    </g>
  );
}
