import { useMemo, type PointerEvent } from 'react';
import { scaleLinear } from 'd3-scale';
import { area, line } from 'd3-shape';
import { ChartFrame, ChartTip } from './ChartFrame';
import { XLabels, YGrid } from './Axis';
import { nearestIndex } from './geometry';
import { useChartCursor } from './useChartCursor';
import { useChartFormat, type NumberFormat } from './useChartFormat';
import { useContainerWidth } from './useContainerWidth';
import styles from './Chart.module.css';

export interface PaceChartProps {
  title: string;
  /** One label per day of the period (its length is the period length). */
  labels: string[];
  /** Cumulative spend per elapsed day (shorter than labels mid-period). */
  actual: number[];
  limit: number;
  height?: number;
  format?: NumberFormat;
  axisFormat?: NumberFormat;
}

const M = { top: 16, right: 12, bottom: 26, left: 60 };

/** Budget burn: cumulative spend against the straight pace line to the limit. */
export function PaceChart({
  title,
  labels,
  actual,
  limit,
  height = 200,
  format,
  axisFormat,
}: PaceChartProps) {
  const { ref, width } = useContainerWidth<HTMLDivElement>();
  const f = useChartFormat(format, axisFormat);
  const cursor = useChartCursor(actual.length);
  const days = Math.max(labels.length, actual.length, 2);
  const paceAt = (i: number) => (limit * (i + 1)) / days;

  const geo = useMemo(() => {
    if (width <= 0) return null;
    const hi = Math.max(limit, ...actual, 1);
    const x = scaleLinear()
      .domain([0, days - 1])
      .range([M.left, width - M.right]);
    const y = scaleLinear()
      .domain([0, hi])
      .nice(4)
      .range([height - M.bottom, M.top]);
    const pts = actual.map((v, i) => [x(i), y(v)] as [number, number]);
    const pace = line()([
      [x(0), y(limit / days)],
      [x(days - 1), y(limit)],
    ]);
    return {
      x,
      y,
      xs: labels.map((_, i) => x(i)),
      pts,
      line: line()(pts) ?? '',
      area: area().y0(y(0))(pts) ?? '',
      pace: pace ?? '',
    };
  }, [actual, labels, limit, days, width, height]);

  const today = actual.length - 1;
  const spent = actual[today] ?? 0;
  const expected = today >= 0 ? paceAt(today) : 0;
  const diff = spent - expected;
  const summary =
    `${title}: ${f.value(spent)} spent of ${f.value(limit)} after ${today + 1} of ${days} days. ` +
    (diff > 0
      ? `${f.value(diff)} ahead of pace.`
      : diff < 0
        ? `${f.value(-diff)} under pace.`
        : 'On pace.');

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    if (!geo || actual.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    cursor.setIndex(
      nearestIndex(
        geo.pts.map((p) => p[0]),
        e.clientX - rect.left + M.left
      )
    );
  };
  const active = geo ? cursor.index : null;
  const over = spent > limit;

  return (
    <ChartFrame
      summary={summary}
      columns={['Day', 'Spent', 'Pace']}
      rows={actual.map((v, i) => ({
        label: labels[i] ?? String(i + 1),
        values: [f.value(v), f.value(paceAt(i))],
      }))}
    >
      <ul className={styles.legend} aria-hidden>
        <li>
          <i className={styles.key} style={{ background: 'var(--viz-line)' }} />
          Spent
        </li>
        <li>
          <i className={styles.key} style={{ background: 'var(--ink-3)' }} />
          Pace
        </li>
        <li>
          <i className={styles.key} style={{ background: 'var(--crit)' }} />
          Limit
        </li>
      </ul>
      <div
        ref={ref}
        className={styles.plot}
        style={{ height }}
        tabIndex={actual.length ? 0 : -1}
        role="group"
        aria-label={`${title}. Use arrow keys to read each day.`}
        onKeyDown={cursor.onKeyDown}
        onBlur={cursor.clear}
      >
        {geo ? (
          <svg className={styles.svg} width={width} height={height} aria-hidden>
            <YGrid y={geo.y} width={width - M.right} left={M.left} format={f.axis} />
            <path d={geo.pace} className={styles.ref} strokeDasharray="4 4" />
            <line
              x1={M.left}
              x2={width - M.right}
              y1={Math.round(geo.y(limit)) + 0.5}
              y2={Math.round(geo.y(limit)) + 0.5}
              className={styles.limit}
            />
            <text
              x={width - M.right}
              y={geo.y(limit) - 5}
              textAnchor="end"
              className={styles.limitLabel}
            >
              Limit {f.value(limit)}
            </text>
            <path
              d={geo.area}
              className={styles.area}
              style={over ? { fill: 'var(--crit-soft)' } : undefined}
            />
            <path
              d={geo.line}
              pathLength={1}
              className={styles.line}
              style={over ? { stroke: 'var(--crit)' } : undefined}
            />
            {today >= 0 && today < days - 1 ? (
              <line
                x1={Math.round(geo.x(today)) + 0.5}
                x2={Math.round(geo.x(today)) + 0.5}
                y1={M.top}
                y2={height - M.bottom}
                className={styles.grid}
                strokeDasharray="2 3"
              />
            ) : null}
            {today >= 0 ? (
              <circle cx={geo.pts[today][0]} cy={geo.pts[today][1]} r={4} className={styles.dot} />
            ) : null}
            <XLabels labels={labels} xs={geo.xs} top={height - M.bottom} width={width} />
            {active !== null ? (
              <line
                x1={Math.round(geo.pts[active][0]) + 0.5}
                x2={Math.round(geo.pts[active][0]) + 0.5}
                y1={M.top}
                y2={height - M.bottom}
                className={styles.cross}
              />
            ) : null}
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
        ) : null}
        {active !== null && geo ? (
          <ChartTip
            x={geo.pts[active][0]}
            width={width}
            title={labels[active] ?? `Day ${active + 1}`}
            rows={[
              {
                key: 's',
                label: 'Spent',
                value: f.value(actual[active]),
                color: 'var(--viz-line)',
              },
              { key: 'p', label: 'Pace', value: f.value(paceAt(active)), color: 'var(--ink-3)' },
            ]}
          />
        ) : null}
      </div>
    </ChartFrame>
  );
}
