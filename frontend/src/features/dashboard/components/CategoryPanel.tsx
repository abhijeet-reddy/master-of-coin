import { CellAlign, EmptyState, Money, MoneySize, Panel, Skeleton, Table, Td, Th, Tr } from '@/ui';
import { usePreferences } from '@/lib/preferences';
import { SignDisplay } from '@/lib/format';
import { shareSummary } from '@/charts';
import { useSummary } from '../hooks/useDashboardQueries';
import { categoryShares, type CategoryShare } from '../lib/dashboardModel';
import { PanelState } from '@/ui/PanelState';
import styles from './Dashboard.module.css';

/** Spend over the last 30 days split by category: a share tape and the table behind it. */
export function CategoryPanel() {
  const summary = useSummary();
  return (
    <Panel title="Spend by category" actions={<span className={styles.meta}>Last 30 days</span>}>
      <PanelState
        query={summary}
        skeleton={<Skeleton lines={8} height={12} />}
        empty={(s) =>
          categoryShares(s.category_breakdown).slices.length === 0 ? (
            <EmptyState compact title="No spending in the last 30 days" />
          ) : null
        }
      >
        {(s) => <Shares share={categoryShares(s.category_breakdown)} />}
      </PanelState>
    </Panel>
  );
}

function Shares({ share }: { share: CategoryShare }) {
  const { fmt } = usePreferences();
  return (
    <div className={styles.stack}>
      <div className={styles.hero}>
        <span className={styles.kicker}>Total spend</span>
        <Money amount={share.total} sign={SignDisplay.Never} size={MoneySize.Large} />
      </div>
      <div
        className={styles.tapeTall}
        role="img"
        aria-label={shareSummary('Spend by category', share.slices, fmt.money)}
      >
        {share.slices.map((s) => (
          <span key={s.key} style={{ flexGrow: s.share, background: s.color }} />
        ))}
      </div>
      <Table caption="Spend by category, last 30 days" hideCaption>
        <thead>
          <tr>
            <Th>Category</Th>
            <Th align={CellAlign.End}>Share</Th>
            <Th align={CellAlign.End}>Amount</Th>
          </tr>
        </thead>
        <tbody>
          {share.slices.map((s) => (
            <Tr key={s.key}>
              <Td>
                <i className={styles.swatch} style={{ background: s.color }} aria-hidden />
                {s.label}
              </Td>
              <Td align={CellAlign.End}>{fmt.percent(s.share * 100, 1)}</Td>
              <Td align={CellAlign.End}>
                <Money amount={s.value} sign={SignDisplay.Never} />
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
