import type { ReactNode } from 'react';
import { BudgetHealth } from '@/api/types';
import { cx } from '@/ui';
import styles from './Budgets.module.css';

const TONE: Record<BudgetHealth, string> = {
  [BudgetHealth.OnTrack]: styles.gPos,
  [BudgetHealth.Warning]: styles.gWarn,
  [BudgetHealth.Over]: styles.gCrit,
};

interface Props {
  percent: number;
  health: BudgetHealth | null;
  size?: number;
  stroke?: number;
  /** Percent of the period elapsed: a tick across the arc. */
  pace?: number | null;
  children?: ReactNode;
}

/**
 * A 270 degree arc gauge. Decorative: the figure inside and the text next to
 * it carry the value, so the SVG is hidden from assistive tech.
 */
export function Gauge({ percent, health, size = 96, stroke = 8, pace = null, children }: Props) {
  const c = size / 2;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const arc = circ * 0.75;
  const p = Number.isFinite(percent) ? Math.max(0, Math.min(percent, 100)) : 0;
  const off = arc * (1 - p / 100);
  const at = (deg: number, radius: number) => {
    const a = (deg * Math.PI) / 180;
    return [c + Math.cos(a) * radius, c + Math.sin(a) * radius] as const;
  };
  const ticks = Array.from({ length: 11 }, (_, i) => {
    const r1 = r + stroke / 2 + 2;
    const r2 = r1 + (i % 5 ? 3 : 6);
    const [x1, y1] = at(135 + i * 27, r1);
    const [x2, y2] = at(135 + i * 27, r2);
    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
  });
  let paceMark = null;
  if (pace != null && Number.isFinite(pace)) {
    const deg = 135 + Math.max(0, Math.min(pace, 100)) * 2.7;
    const [x1, y1] = at(deg, r - stroke / 2 - 2);
    const [x2, y2] = at(deg, r + stroke / 2 + 2);
    paceMark = <line className={styles.pace} x1={x1} y1={y1} x2={x2} y2={y2} />;
  }
  return (
    <div
      className={cx(styles.gauge, health ? TONE[health] : styles.gNone)}
      style={{ width: size, maxWidth: '100%', aspectRatio: '1' }}
    >
      <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <g className={styles.ticks}>{ticks}</g>
        <circle
          className={styles.trk}
          cx={c}
          cy={c}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={`${arc} ${circ}`}
          transform={`rotate(135 ${c} ${c})`}
        />
        <circle
          className={styles.val}
          cx={c}
          cy={c}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={`${arc} ${circ}`}
          strokeDashoffset={off}
          transform={`rotate(135 ${c} ${c})`}
        />
        {paceMark}
      </svg>
      <div className={styles.read}>{children}</div>
    </div>
  );
}
