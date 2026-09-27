import { useMemo } from 'react';
import { arc, pie, type PieArcDatum } from 'd3-shape';
import { ChartFrame } from './ChartFrame';
import { foldSlices, type ShareItem, type Slice } from './foldSlices';
import { shareSummary } from './summary';
import { useChartCursor } from './useChartCursor';
import { useChartFormat, type NumberFormat } from './useChartFormat';
import styles from './Chart.module.css';

export interface DonutProps {
  title: string;
  items: ShareItem[];
  size?: number;
  /** Small caption under the centre total, e.g. "Spent". */
  centerLabel?: string;
  format?: NumberFormat;
}

/** Share of a total. Folds past 7 into Other; the legend lists every value and percent. */
export function Donut({ title, items, size = 168, centerLabel = 'Total', format }: DonutProps) {
  const f = useChartFormat(format);
  const slices = useMemo(() => foldSlices(items), [items]);
  const cursor = useChartCursor(slices.length);
  const total = slices.reduce((s, i) => s + i.value, 0);

  const arcs = useMemo(() => {
    const r = size / 2;
    const gen = arc<PieArcDatum<Slice>>()
      .innerRadius(r * 0.64)
      .outerRadius(r - 2)
      .padAngle(slices.length > 1 ? 0.012 : 0);
    return pie<Slice>()
      .sort(null)
      .value((s) => s.value)(slices)
      .map((a) => ({ key: a.data.key, d: gen(a) ?? '', color: a.data.color }));
  }, [slices, size]);

  const active = cursor.index;
  const shown = active !== null ? slices[active] : null;
  const pct = (s: Slice) => `${Math.round(s.share * 100)}%`;

  return (
    <ChartFrame
      summary={shareSummary(title, slices, f.value)}
      columns={['Category', 'Amount', 'Share']}
      rows={slices.map((s) => ({ label: s.label, values: [f.value(s.value), pct(s)] }))}
    >
      {slices.length === 0 ? (
        <div className={styles.empty} style={{ height: size }}>
          No data
        </div>
      ) : (
        <div className={styles.donutWrap}>
          <div
            className={styles.plot}
            style={{ width: size, height: size }}
            tabIndex={0}
            role="group"
            aria-label={`${title}. Use arrow keys to read each slice.`}
            onKeyDown={cursor.onKeyDown}
            onBlur={cursor.clear}
          >
            <svg className={styles.svg} width={size} height={size} aria-hidden>
              <g transform={`translate(${size / 2},${size / 2})`}>
                {arcs.map((a, i) => (
                  <path
                    key={a.key}
                    d={a.d}
                    fill={a.color}
                    className={`${styles.slice} ${active !== null && active !== i ? styles.dim : ''}`}
                    onPointerEnter={() => cursor.setIndex(i)}
                    onPointerLeave={cursor.clear}
                  />
                ))}
                <text y={-2} textAnchor="middle" className={styles.donutCenter}>
                  {f.value(shown ? shown.value : total)}
                </text>
                <text y={16} textAnchor="middle" className={styles.donutSub}>
                  {shown ? pct(shown) : centerLabel}
                </text>
              </g>
            </svg>
          </div>
          <ul className={styles.rows} aria-hidden>
            {slices.map((s, i) => (
              <li
                key={s.key}
                className={active === i ? styles.activeRow : undefined}
                onPointerEnter={() => cursor.setIndex(i)}
                onPointerLeave={cursor.clear}
              >
                <i className={styles.keyBox} style={{ background: s.color }} />
                <span className={styles.rowName}>{s.label}</span>
                <span className={styles.rowVal}>{f.value(s.value)}</span>
                <span className={styles.rowPct}>{pct(s)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartFrame>
  );
}
