import { TrendingDown, TrendingUp } from 'lucide-react';
import { AreaChart } from '@/charts';
import { DateStyle, SignDisplay } from '@/lib/format';
import { usePreferences } from '@/lib/preferences';
import { EmptyState, Money, MoneySize, Panel, Skeleton, Stat, StatGroup } from '@/ui';
import { useNetWorthHistory, useSummary } from '../hooks/useDashboardQueries';
import { balanceSheet, netWorthDelta, type NetWorthDelta } from '../lib/dashboardModel';
import type { NetWorthPoint } from '@/api/types/analytics';
import { PanelState } from '@/ui/PanelState';
import styles from './Dashboard.module.css';

/** Hero net worth, change over the history, assets vs liabilities and the 12 month line. */
export function NetWorthPanel() {
  const summary = useSummary();
  const history = useNetWorthHistory();
  const { prefs } = usePreferences();
  const currency = summary.data?.currency ?? prefs.default_currency;
  return (
    <Panel
      title="Net worth"
      actions={<span className={styles.meta}>{currency} base, 12M</span>}
      flush
    >
      <div className={styles.pad}>
        <PanelState query={summary} skeleton={<Skeleton height={64} width="60%" />}>
          {(s) => (
            <div className={styles.hero}>
              <span className={styles.kicker}>Total net worth</span>
              <Money amount={s.net_worth} currency={currency} size={MoneySize.Hero} />
            </div>
          )}
        </PanelState>
      </div>
      <PanelState
        query={history}
        skeleton={
          <div className={styles.pad}>
            <Skeleton lines={3} />
            <Skeleton height={200} />
          </div>
        }
        empty={(points) =>
          points.length === 0 ? (
            <EmptyState
              compact
              title="No history yet"
              description="Add an account to start tracking net worth."
            />
          ) : null
        }
      >
        {(points) => <HistoryBody points={points} currency={currency} />}
      </PanelState>
    </Panel>
  );
}

function HistoryBody({ points, currency }: { points: NetWorthPoint[]; currency: string }) {
  const { fmt } = usePreferences();
  const sheet = balanceSheet(points[points.length - 1]?.by_type, []);
  const delta = netWorthDelta(points);
  return (
    <>
      <div className={styles.pad}>
        {delta ? <DeltaLine delta={delta} currency={currency} /> : null}
      </div>
      <StatGroup label="Assets and liabilities">
        <Stat
          label="Assets"
          value={<Money amount={sheet.assets} currency={currency} size={MoneySize.Medium} />}
        />
        <Stat
          label="Liabilities"
          value={<Money amount={sheet.liabilities} currency={currency} size={MoneySize.Medium} />}
        />
      </StatGroup>
      <div className={styles.chart}>
        <AreaChart
          title="Net worth"
          height={220}
          includeZero={false}
          data={points.map((p) => ({
            label: fmt.date(p.date, DateStyle.MonthYear),
            value: Number(p.total),
          }))}
        />
        <p className={styles.note}>Past points use today&apos;s exchange rates.</p>
      </div>
    </>
  );
}

function DeltaLine({ delta, currency }: { delta: NetWorthDelta; currency: string }) {
  const { fmt } = usePreferences();
  const up = delta.change >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <p className={up ? styles.deltaUp : styles.deltaDown}>
      <Icon aria-hidden className={styles.deltaIcon} />
      <span>{up ? 'Up' : 'Down'}</span>
      <Money amount={Math.abs(delta.change)} currency={currency} sign={SignDisplay.Never} />
      {delta.percent != null ? (
        <span>{`${up ? '+' : ''}${fmt.percent(delta.percent, 1)}`}</span>
      ) : null}
      <span className={styles.since}>since {fmt.date(delta.since, DateStyle.MonthYear)}</span>
    </p>
  );
}
