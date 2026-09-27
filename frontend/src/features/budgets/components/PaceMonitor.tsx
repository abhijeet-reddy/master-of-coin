import { BudgetHealth } from '@/api/types';
import { useContainerWidth } from '@/charts';
import { usePreferences } from '@/lib/preferences';
import { EmptyState, Panel } from '@/ui';
import { PACE_LABEL, PACE_Y_MAX, Pace, spreadLabels, type BudgetStats } from '../lib/budgetsModel';
import styles from './Budgets.module.css';

const H = 230;
const M = { l: 40, r: 14, t: 12, b: 28 };
const COLOR: Record<BudgetHealth, string> = {
  [BudgetHealth.OnTrack]: 'var(--pos)',
  [BudgetHealth.Warning]: 'var(--warn)',
  [BudgetHealth.Over]: 'var(--crit)',
};

/**
 * Every active budget as a point: time elapsed across, limit used up. Above
 * the dashed diagonal means spending ahead of time.
 */
export function PaceMonitor({ list }: { list: BudgetStats[] }) {
  const { fmt } = usePreferences();
  const { ref, width } = useContainerWidth<HTMLDivElement>();
  const pts = list.filter((s) => s.active);
  const off = pts.filter((s) => s.pace !== Pace.OnTrack).length;
  const W = Math.max(width, 280);
  const X = (v: number) => M.l + (Math.max(0, Math.min(100, v)) / 100) * (W - M.l - M.r);
  const Y = (v: number) =>
    M.t + (1 - Math.max(0, Math.min(PACE_Y_MAX, v)) / PACE_Y_MAX) * (H - M.t - M.b);
  const placed = pts.map((s) => {
    const x = X(s.elapsedPct);
    const y = Y(s.percent);
    return { s, x, y, left: x > M.l + (W - M.l - M.r) * 0.62 };
  });
  const labelY = new Map<string, number>();
  for (const side of [true, false]) {
    const group = placed.filter((p) => p.left === side);
    const ys = spreadLabels(
      group.map((p) => p.y + 3.5),
      13,
      M.t + 10,
      H - M.b - 4
    );
    group.forEach((p, i) => labelY.set(p.s.id, ys[i]));
  }

  return (
    <Panel
      title="Pace monitor"
      actions={<span className={styles.micro}>Above the line: spending ahead of time</span>}
    >
      {pts.length === 0 ? (
        <EmptyState
          compact
          title="Nothing to pace"
          description="Budgets appear here once a range covers today."
        />
      ) : (
        <figure className={styles.scatter}>
          <div ref={ref} className={styles.scatterBox}>
            {width > 0 ? (
              <svg viewBox={`0 0 ${W} ${H}`} height={H} aria-hidden>
                {[0, 50, 100, 150].map((v) => (
                  <g key={v}>
                    <line className={styles.gridl} x1={M.l} x2={W - M.r} y1={Y(v)} y2={Y(v)} />
                    <text x={M.l - 6} y={Y(v) + 3.5} textAnchor="end">
                      {v}%
                    </text>
                  </g>
                ))}
                {[0, 25, 50, 75, 100].map((v) => (
                  <text
                    key={v}
                    x={X(v)}
                    y={H - 8}
                    textAnchor={v === 100 ? 'end' : v === 0 ? 'start' : 'middle'}
                  >
                    {v}%
                  </text>
                ))}
                <rect
                  className={styles.overBand}
                  x={M.l}
                  y={Y(PACE_Y_MAX)}
                  width={W - M.l - M.r}
                  height={Y(100) - Y(PACE_Y_MAX)}
                />
                <line className={styles.axis} x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} />
                <line className={styles.paceLine} x1={X(0)} y1={Y(0)} x2={X(100)} y2={Y(100)} />
                <text x={X(30)} y={Y(30) + 16} textAnchor="middle">
                  ON PACE
                </text>
                <text className={styles.overText} x={M.l + 6} y={Y(PACE_Y_MAX) + 14}>
                  OVER LIMIT
                </text>
                {placed.map(({ s, x, y, left }) => {
                  const col = s.health ? COLOR[s.health] : 'var(--accent)';
                  return (
                    <g key={s.id} className={styles.pt}>
                      <rect
                        x={x - 5}
                        y={y - 5}
                        width={10}
                        height={10}
                        fill={col}
                        stroke="var(--panel)"
                        strokeWidth={2}
                      />
                      {s.health === BudgetHealth.Over ? (
                        <rect x={x - 9} y={y - 9} width={18} height={18} fill="none" stroke={col} />
                      ) : null}
                      <text
                        className={styles.ptLabel}
                        x={left ? x - 12 : x + 12}
                        y={labelY.get(s.id) ?? y + 3.5}
                        textAnchor={left ? 'end' : 'start'}
                      >
                        {s.name} {fmt.percent(s.percent)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            ) : (
              <div style={{ height: H }} />
            )}
          </div>
          <figcaption className={`${styles.micro} ${styles.caption}`}>
            <span>X: period elapsed. Y: limit used.</span>
            <span>
              {off} of {pts.length} off pace
            </span>
          </figcaption>
          <ul className="sr-only">
            {pts.map((s) => (
              <li key={s.id}>
                {s.name}: {fmt.percent(s.percent)} used with {fmt.percent(s.elapsedPct)} of the
                period elapsed, {PACE_LABEL[s.pace].toLowerCase()}.
              </li>
            ))}
          </ul>
        </figure>
      )}
    </Panel>
  );
}
