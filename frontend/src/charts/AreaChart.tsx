import { useMemo, type PointerEvent } from 'react';
import { scaleLinear } from 'd3-scale';
import { area, line } from 'd3-shape';
import { ChartFrame, ChartTip } from './ChartFrame';
import { XLabels, YGrid } from './Axis';
import { nearestIndex } from './geometry';
import { trendSummary } from './summary';
import { useChartCursor } from './useChartCursor';
import { useChartFormat, type NumberFormat } from './useChartFormat';
import { useContainerWidth } from './useContainerWidth';
import styles from './Chart.module.css';

export interface SeriesPoint {
  label: string;
  value: number;
}

export interface AreaChartProps {
  /** Names the series; drives the summary and the tooltip. */
  title: string;
  data: SeriesPoint[];
  height?: number;
  format?: NumberFormat;
  axisFormat?: NumberFormat;
  /** Keep 0 on the value axis (default). Turn off for levels far from zero, e.g. net worth. */
  includeZero?: boolean;
}

const M = { top: 10, right: 12, bottom: 26, left: 60 };

/** Single-series area over time with a crosshair readout (pointer and arrow keys). */
export function AreaChart({
  title,
  data,
  height = 220,
  format,
  axisFormat,
  includeZero = true,
}: AreaChartProps) {
  const { ref, width } = useContainerWidth<HTMLDivElement>();
  const f = useChartFormat(format, axisFormat);
  const cursor = useChartCursor(data.length);

  const geo = useMemo(() => {
    if (width <= 0 || data.length === 0) return null;
    const values = data.map((d) => d.value);
    const floor = includeZero ? [0] : [];
    const lo = Math.min(...floor, ...values);
    const hi = Math.max(...floor, ...values);
    const x = scaleLinear()
      .domain([0, Math.max(1, data.length - 1)])
      .range([M.left, width - M.right]);
    const y = scaleLinear()
      .domain(lo === hi ? [lo, lo + 1] : [lo, hi])
      .nice(4)
      .range([height - M.bottom, M.top]);
    const pts = data.map((d, i) => [x(i), y(d.value)] as [number, number]);
    return {
      x,
      y,
      xs: pts.map((p) => p[0]),
      pts,
      line: line()(pts) ?? '',
      area: area().y0(y(Math.min(Math.max(0, y.domain()[0]), y.domain()[1])))(pts) ?? '',
    };
  }, [data, width, height, includeZero]);

  const summary = trendSummary(
    title,
    data.map((d) => d.value),
    data.map((d) => d.label),
    f.value
  );

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    if (!geo) return;
    const rect = e.currentTarget.getBoundingClientRect();
    cursor.setIndex(nearestIndex(geo.xs, e.clientX - rect.left + M.left));
  };

  const active = cursor.index !== null && geo ? cursor.index : null;

  return (
    <ChartFrame
      summary={summary}
      columns={['Period', title]}
      rows={data.map((d) => ({ label: d.label, values: [f.value(d.value)] }))}
    >
      <div
        ref={ref}
        className={styles.plot}
        style={{ height }}
        tabIndex={data.length ? 0 : -1}
        role="group"
        aria-label={`${title}. Use arrow keys to read values.`}
        onKeyDown={cursor.onKeyDown}
        onBlur={cursor.clear}
      >
        {geo ? (
          <svg className={styles.svg} width={width} height={height} aria-hidden>
            <YGrid y={geo.y} width={width - M.right} left={M.left} format={f.axis} />
            <path d={geo.area} className={styles.area} />
            <path d={geo.line} className={styles.line} />
            <XLabels
              labels={data.map((d) => d.label)}
              xs={geo.xs}
              top={height - M.bottom}
              width={width}
            />
            {active !== null ? (
              <g>
                <line
                  x1={Math.round(geo.xs[active]) + 0.5}
                  x2={Math.round(geo.xs[active]) + 0.5}
                  y1={M.top}
                  y2={height - M.bottom}
                  className={styles.cross}
                />
                <circle
                  cx={geo.pts[active][0]}
                  cy={geo.pts[active][1]}
                  r={4}
                  className={styles.dot}
                />
              </g>
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
        ) : data.length === 0 ? (
          <div className={styles.empty} style={{ height }}>
            No data
          </div>
        ) : null}
        {active !== null && geo ? (
          <ChartTip
            x={geo.xs[active]}
            width={width}
            title={data[active].label}
            rows={[
              {
                key: 'v',
                label: title,
                value: f.value(data[active].value),
                color: 'var(--viz-line)',
              },
            ]}
          />
        ) : null}
      </div>
    </ChartFrame>
  );
}
