import { Donut, shareSummary } from '@/charts';
import { SignDisplay } from '@/lib/format';
import { usePreferences } from '@/lib/preferences';
import {
  CellAlign,
  EmptyState,
  Money,
  MoneySize,
  Panel,
  PanelState,
  Skeleton,
  Table,
  Td,
  Th,
  Tr,
} from '@/ui';
import { useSummary } from '@/features/dashboard/hooks/useDashboardQueries';
import { categoryShares, type CategoryShare } from '@/features/dashboard/lib/dashboardModel';
import styles from './Reports.module.css';

/** Spend by category from the server breakdown, which always covers the last 30 days. */
export function CategoriesTab() {
  const summary = useSummary();
  return (
    <div className={styles.tabBody}>
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
          {(s) => (
            <Breakdown share={categoryShares(s.category_breakdown, 10)} currency={s.currency} />
          )}
        </PanelState>
      </Panel>
    </div>
  );
}

function Breakdown({ share, currency }: { share: CategoryShare; currency: string }) {
  const { fmt } = usePreferences();
  const money = (n: number) => fmt.money(n, currency);
  return (
    <>
      <p className={styles.intro}>
        This breakdown always covers the last 30 days, whatever period the other tabs show.
      </p>
      <div className={styles.split}>
        <div className={styles.hero}>
          <span className={styles.kicker}>Total spend</span>
          <Money
            amount={share.total}
            currency={currency}
            sign={SignDisplay.Never}
            size={MoneySize.Large}
          />
          <Donut title="Spend by category" items={share.slices} format={money} />
        </div>
        <div className={styles.tableWrap}>
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
                    <Money amount={s.value} currency={currency} sign={SignDisplay.Never} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      </div>
      <p className={styles.summary} aria-hidden>
        {shareSummary('Spend by category over the last 30 days', share.slices, money)}
      </p>
    </>
  );
}
