import type { CSSProperties, ReactNode } from 'react';
import { cx } from './cx';
import styles from './Panel.module.css';

export interface PanelProps {
  /** Rendered as an h2 in brackets: [ TITLE ]. */
  title?: string;
  /** Right side of the header: badges, a menu, small buttons. */
  actions?: ReactNode;
  children: ReactNode;
  /** No body padding (tables, lists). */
  flush?: boolean;
}

/** The Telemetry panel. Place inside a <PanelGrid> for hairline gutters. */
export function Panel({ title, actions, children, flush = false }: PanelProps) {
  return (
    <section className={cx(styles.panel, 'moc-sweep')} aria-label={title}>
      {title || actions ? (
        <header className={styles.head}>
          {title ? <h2 className={styles.title}>{title}</h2> : <span />}
          {actions ? <div className={styles.meta}>{actions}</div> : null}
        </header>
      ) : null}
      <div className={cx(styles.body, flush && styles.flush)}>{children}</div>
    </section>
  );
}

/** 12-column hairline grid; children set `--span` (and optional `--span-md`) via <GridCell>. */
export function PanelGrid({ children }: { children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}

export function GridCell({
  span = 12,
  spanMd,
  children,
}: {
  span?: number;
  spanMd?: number;
  children: ReactNode;
}) {
  return (
    <div
      style={
        {
          '--span': span,
          '--span-md': spanMd ?? (span <= 6 ? 6 : 12),
          display: 'grid',
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
