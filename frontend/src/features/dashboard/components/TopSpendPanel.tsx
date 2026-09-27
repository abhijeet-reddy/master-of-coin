import type { CSSProperties } from 'react';
import { SignDisplay } from '@/lib/format';
import { usePreferences } from '@/lib/preferences';
import { EmptyState, Money, Panel, Skeleton } from '@/ui';
import { useSummary } from '../hooks/useDashboardQueries';
import { topSpend, type RankRow } from '../lib/dashboardModel';
import { PanelState } from '@/ui/PanelState';
import styles from './Dashboard.module.css';

/** The five biggest categories, ranked, bars scaled to the top one. */
export function TopSpendPanel() {
  const summary = useSummary();
  return (
    <Panel title="Top spend" actions={<span className={styles.meta}>30 days</span>}>
      <PanelState
        query={summary}
        skeleton={<Skeleton lines={5} height={14} />}
        empty={(s) =>
          topSpend(s.category_breakdown).length === 0 ? (
            <EmptyState compact title="Nothing spent yet" />
          ) : null
        }
      >
        {(s) => <Ranked rows={topSpend(s.category_breakdown)} />}
      </PanelState>
    </Panel>
  );
}

function Ranked({ rows }: { rows: RankRow[] }) {
  const { fmt } = usePreferences();
  const top = rows[0];
  return (
    <div className={styles.stack}>
      <ol className={styles.rank}>
        {rows.map((r, i) => (
          <li key={r.key} className={styles.rankRow}>
            <span className={styles.rankNo} aria-hidden>
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className={styles.rankName}>{r.label}</span>
            <Money amount={r.value} sign={SignDisplay.Never} />
            <span
              className={styles.rankBar}
              style={{ '--w': `${r.width * 100}%` } as CSSProperties}
              aria-hidden
            />
          </li>
        ))}
      </ol>
      {top ? (
        <p className={styles.note}>
          {top.label} is {fmt.percent(top.percent, 1)} of all spend
        </p>
      ) : null}
    </div>
  );
}
