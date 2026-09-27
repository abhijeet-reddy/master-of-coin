import { AreaChart } from '@/charts';
import { DateStyle, SignDisplay } from '@/lib/format';
import { usePreferences } from '@/lib/preferences';
import {
  CellAlign,
  EmptyState,
  Money,
  MoneySize,
  Panel,
  PanelState,
  Skeleton,
  Stat,
  StatGroup,
  Table,
  Td,
  Th,
  Tr,
} from '@/ui';
import type { NetWorthPoint } from '@/api/types/analytics';
import { HistoryInterval } from '@/api/analytics';
import { useNetWorthInRange } from '../hooks/useReportQueries';
import { historyInterval, type DateRange } from '../lib/reportRange';
import { netWorthRange, netWorthText, signFor, type NetWorthRange } from '../lib/reportsModel';
import styles from './Reports.module.css';

/** Net worth across the period: where it started, where it ended, and by account type. */
export function NetWorthTab({ range }: { range: DateRange }) {
  const history = useNetWorthInRange(range);
  const weekly = historyInterval(range) === HistoryInterval.Week;
  return (
    <div className={styles.tabBody}>
      <Panel
        title="Net worth"
        actions={<span className={styles.meta}>{weekly ? 'Weekly' : 'Monthly'}</span>}
        flush
      >
        <PanelState
          query={history}
          skeleton={
            <div className={styles.pad}>
              <Skeleton height={64} width="60%" />
              <Skeleton height={200} />
            </div>
          }
          empty={(points) =>
            points.length === 0 ? (
              <EmptyState
                compact
                title="No history in this period"
                description="Add an account to start tracking net worth."
              />
            ) : null
          }
        >
          {(points) => <Body points={points} weekly={weekly} />}
        </PanelState>
      </Panel>
    </div>
  );
}

function Body({ points, weekly }: { points: NetWorthPoint[]; weekly: boolean }) {
  const { fmt } = usePreferences();
  const r = netWorthRange(points) as NetWorthRange;
  return (
    <>
      <div className={styles.pad}>
        <div className={styles.hero}>
          <span className={styles.kicker}>
            Net worth at {fmt.date(points[points.length - 1].date)}
          </span>
          <Money amount={r.end} size={MoneySize.Hero} />
        </div>
      </div>
      <StatGroup label="Change over the period">
        <Stat
          label="Change"
          value={<Money amount={r.change} sign={signFor(r.change)} size={MoneySize.Medium} />}
          foot={r.percent == null ? undefined : fmt.percent(r.percent, 1)}
        />
        <Stat label="Assets" value={<Money amount={r.sheet.assets} size={MoneySize.Medium} />} />
        <Stat
          label="Liabilities"
          value={<Money amount={r.sheet.liabilities} size={MoneySize.Medium} />}
        />
      </StatGroup>
      <div className={styles.chart}>
        <AreaChart
          title="Net worth"
          height={220}
          includeZero={false}
          data={points.map((p) => ({
            label: fmt.date(p.date, weekly ? undefined : DateStyle.MonthYear),
            value: Number(p.total) || 0,
          }))}
        />
        <p className={styles.summary}>{netWorthText(r, fmt)}</p>
      </div>
      <div className={styles.tableWrap}>
        <Table caption="Net worth by account type at the end of the period">
          <thead>
            <tr>
              <Th>Account type</Th>
              <Th align={CellAlign.End}>Balance</Th>
            </tr>
          </thead>
          <tbody>
            {r.sheet.rows.map((row) => (
              <Tr key={row.type}>
                <Td>{row.label}</Td>
                <Td align={CellAlign.End}>
                  <Money amount={row.total} sign={SignDisplay.Auto} />
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>
      <p className={styles.note}>
        Foreign-currency balances are valued at current rates at every point.
      </p>
    </>
  );
}
