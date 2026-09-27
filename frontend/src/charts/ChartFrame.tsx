import type { ReactNode } from 'react';
import styles from './Chart.module.css';

export interface ChartTableRow {
  label: string;
  values: string[];
}

export interface ChartFrameProps {
  /** Screen-reader summary; also the figure's accessible description. */
  summary: string;
  /** Header row for the hidden data table (first column is the label). */
  columns?: string[];
  rows?: ChartTableRow[];
  children: ReactNode;
}

/** Figure wrapper: visual chart plus a text summary and a data table for assistive tech. */
export function ChartFrame({ summary, columns, rows, children }: ChartFrameProps) {
  return (
    <figure className={styles.figure}>
      {children}
      <figcaption className="sr-only">{summary}</figcaption>
      {columns && rows && rows.length ? (
        <table className="sr-only">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${i}-${r.label}`}>
                <th scope="row">{r.label}</th>
                {r.values.map((v, i) => (
                  <td key={i}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </figure>
  );
}

export interface TipRow {
  key: string;
  label: string;
  value: string;
  color: string;
  /** Line key for lines, box for bars and areas. */
  box?: boolean;
}

/** One tooltip, every series at the active x. Values lead, labels follow. */
export function ChartTip({
  x,
  width,
  title,
  rows,
}: {
  x: number;
  width: number;
  title: string;
  rows: TipRow[];
}) {
  const flip = x > width - 170;
  return (
    <div
      className={styles.tip}
      style={flip ? { right: Math.max(0, width - x + 12) } : { left: x + 12 }}
      aria-hidden
    >
      <span className={styles.tipTitle}>{title}</span>
      {rows.map((r) => (
        <span key={r.key} className={styles.tipRow}>
          <i className={r.box ? styles.keyBox : styles.key} style={{ background: r.color }} />
          <b>{r.value}</b>
          <span>{r.label}</span>
        </span>
      ))}
    </div>
  );
}
