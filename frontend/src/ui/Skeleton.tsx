import type { CSSProperties } from 'react';
import styles from './State.module.css';

export interface SkeletonProps {
  /** CSS width, default 100%. */
  width?: string | number;
  height?: string | number;
  /** Render several stacked bars with ragged widths. */
  lines?: number;
}

/** Placeholder bar. Wrap loading regions in aria-busy; the bars themselves are hidden from AT. */
export function Skeleton({ width = '100%', height = 10, lines }: SkeletonProps) {
  if (lines && lines > 1) {
    return (
      <span className={styles.lines} aria-hidden>
        {Array.from({ length: lines }, (_, i) => (
          <span
            key={i}
            className={styles.skel}
            style={{ width: `${[92, 76, 84, 60][i % 4]}%`, height } as CSSProperties}
          />
        ))}
      </span>
    );
  }
  return <span className={styles.skel} style={{ width, height }} aria-hidden />;
}
