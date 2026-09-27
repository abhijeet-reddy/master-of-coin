import type { CSSProperties, ReactNode } from 'react';
import { cx } from './cx';
import { meterTone } from './meterTone';
import type { Tone } from './types';
import styles from './Meter.module.css';

export interface MeterProps {
  /** Percent used; values over 100 fill the bar and read as over. */
  percent: number;
  /** Accessible name, e.g. "Groceries budget". */
  label: string;
  /** Percent of the period elapsed; draws the pace marker. */
  pace?: number;
  /** Defaults to meterTone(percent). */
  tone?: Tone;
  /** Optional visible caption row below the bar. */
  caption?: ReactNode;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/** Segmented usage bar with an optional pace marker (role=meter). */
export function Meter({ percent, label, pace, tone, caption }: MeterProps) {
  const p = Number.isFinite(percent) ? percent : 0;
  const valueText =
    `${Math.round(p)}% used` + (pace != null ? `, ${Math.round(pace)}% of period elapsed` : '');
  return (
    <div className={styles.wrap}>
      <div
        className={cx(styles.meter, styles[tone ?? meterTone(p)])}
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamp(p))}
        aria-valuetext={valueText}
        style={{ '--p': `${clamp(p)}%` } as CSSProperties}
      >
        <div className={styles.track} />
        <div className={styles.fill} />
        {pace != null ? (
          <span className={styles.pace} style={{ '--x': `${clamp(pace)}%` } as CSSProperties} />
        ) : null}
      </div>
      {caption ? <div className={styles.caption}>{caption}</div> : null}
    </div>
  );
}
