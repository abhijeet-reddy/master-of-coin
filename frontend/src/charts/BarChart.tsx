import { useMemo, type PointerEvent } from 'react';
import { scaleBand, scaleLinear } from 'd3-scale';
import { ChartFrame, ChartTip } from './ChartFrame';
import { XLabels, YGrid } from './Axis';
import { barPath, categoryColor, nearestIndex } from './geometry';
import { useChartCursor } from './useChartCursor';
import { useChartFormat, type NumberFormat } from './useChartFormat';
import { useContainerWidth } from './useContainerWidth';
import styles from './Chart.module.css';

export interface BarSeries {
  key: string;
  label: string;
  values: number[];
  /** CSS colour; defaults to the categorical slot for the series index. */
  color?: string;
}

export interface BarChartProps {
  title: string;
  labels: string[];
  series: BarSeries[];
  height?: number;
  format?: NumberFormat;
  axisFormat?: NumberFormat;
}

const M = { top: 10, right: 12, bottom: 26, left: 60 };
const MAX_BAR = 24;
const GAP = 2;

/** Grouped bars per category (e.g. income vs spend per month). Negative values hang below zero. */
export function BarChart({
  title,
  labels,
  series,
  height = 220,
  format,
  axisFormat,
}: BarChartProps) {
  const { ref, width } = useContainerWidth<HTMLDivElement>();
  const f = useChartFormat(format, axisFormat);
  const cursor = useChartCursor(labels.length);
  const colors = series.map((s, i) => s.color ?? categoryColor(i));

  const geo = useMemo(() => {
    if (width <= 0 || labels.length === 0) return null;
    const all = series.flatMap((s) => s.values);
    const lo = Math.min(0, ...all);
    const hi = Math.max(0, ...all);
    const x = scaleBand<number>()
      .domain(labels.map((_, i) => i))
      .range([M.left, width - M.right])
      .paddingInner(0.3)
      .paddingOuter(0.15);
    const y = scaleLinear()
      .domain(lo === hi ? [0, 1] : [lo, hi])
      .nice(4)
      .range([height - M.bottom, M.top]);
    const n = Math.max(1, series.length);
    const barW = Math.max(2, Math.min(MAX_BAR, (x.bandwidth() - GAP * (n - 1)) / n));
    const groupW = barW * n + GAP * (n - 1);
    const zero = y(0);
    const bars = labels.map((_, i) => {
      const start = (x(i) ?? 0) + (x.bandwidth() - groupW) / 2;
      return series.map((s, si) => {
        const v = s.values[i] ?? 0;
        const neg = v < 0;
        const top = neg ? zero : y(v);
        const h = Math.abs(y(v) - zero);
        return barPath(start + si * (barW + GAP), top, barW, h, neg);
      });
    });
    const centers = labels.map((_, i) => (x(i) ?? 0) + x.bandwidth() / 2);
    return { y, bars, centers, band: x.bandwidth(), step: x.step() };
  }, [labels, series, width, height]);

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    if (!geo) return;
    const rect = e.currentTarget.getBoundingClientRect();
    cursor.setIndex(nearestIndex(geo.centers, e.clientX - rect.left + M.left));
  };

  const active = geo ? cursor.index : null;
  const summary = barSummary(title, labels, series, f.value);

  return (
    <ChartFrame
      summary={summary}
      columns={['Period', ...series.map((s) => s.label)]}
      rows={labels.map((l, i) => ({
        label: l,
        values: series.map((s) => f.value(s.values[i] ?? 0)),
      }))}
    >
      {series.length > 1 ? (
        <ul className={styles.legend} aria-hidden>
          {series.map((s, i) => (
            <li key={s.key}>
              <i className={styles.keyBox} style={{ background: colors[i] }} />
              {s.label}
            </li>
          ))}
        </ul>
      ) : null}
      <div
        ref={ref}
        className={styles.plot}
        style={{ height }}
        tabIndex={labels.length ? 0 : -1}
        role="group"
        aria-label={`${title}. Use arrow keys to read values.`}
        onKeyDown={cursor.onKeyDown}
        onBlur={cursor.clear}
      >
        {geo ? (
          <svg className={styles.svg} width={width} height={height} aria-hidden>
            <YGrid y={geo.y} width={width - M.right} left={M.left} format={f.axis} />
            {active !== null ? (
              <rect
                x={geo.centers[active] - geo.step / 2}
                y={M.top}
                width={geo.step}
                height={height - M.top - M.bottom}
                fill="var(--panel-2)"
              />
            ) : null}
            {geo.bars.map((group, i) =>
              group.map((d, si) => (
                <path
                  key={`${i}-${si}`}
                  d={d}
                  fill={colors[si]}
                  className={`${styles.bar} ${active !== null && active !== i ? styles.dim : ''}`}
                />
              ))
            )}
            <line
              x1={M.left}
              x2={width - M.right}
              y1={Math.round(geo.y(0)) + 0.5}
              y2={Math.round(geo.y(0)) + 0.5}
              className={styles.baseline}
            />
            <XLabels labels={labels} xs={geo.centers} top={height - M.bottom} width={width} />
            <rect
              x={M.left}
              y={0}
              width={Math.max(0, width - M.left - M.right)}
              height={height - M.bottom}
              className={styles.hit}
              onPointerMove={onMove}
              onPointerLeave={cursor.clear}
            />
          </svg>
        ) : labels.length === 0 ? (
          <div className={styles.empty} style={{ height }}>
            No data
          </div>
        ) : null}
        {active !== null && geo ? (
          <ChartTip
            x={geo.centers[active]}
            width={width}
            title={labels[active]}
            rows={series.map((s, i) => ({
              key: s.key,
              label: s.label,
              value: f.value(s.values[active] ?? 0),
              color: colors[i],
              box: true,
            }))}
          />
        ) : null}
      </div>
    </ChartFrame>
  );
}

function barSummary(
  title: string,
  labels: string[],
  series: BarSeries[],
  format: NumberFormat
): string {
  if (labels.length === 0) return `${title}: no data.`;
  const range = `${labels[0]} to ${labels[labels.length - 1]}`;
  const parts = series.map((s) => {
    const total = s.values.reduce((a, b) => a + b, 0);
    const avg = total / Math.max(1, s.values.length);
    return `${s.label} total ${format(total)}, average ${format(avg)}`;
  });
  return `${title}, ${range}: ${parts.join('; ')}.`;
}
