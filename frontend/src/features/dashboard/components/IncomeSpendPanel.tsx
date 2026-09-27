import { BarChart } from '@/charts';
import { DateStyle, SignDisplay } from '@/lib/format';
import { usePreferences } from '@/lib/preferences';
import { EmptyState, Money, MoneySize, Panel, Skeleton, Stat, StatGroup } from '@/ui';
import { MONTHS, useMonthlyTotals } from '../hooks/useDashboardQueries';
import { isQuietSeries, monthDate, monthlyStats, type MonthlyStats } from '../lib/dashboardModel';
import { PanelState } from '@/ui/PanelState';
import styles from './Dashboard.module.css';

/** This month's income, spend and savings rate over 12 months of grouped bars. */
export function IncomeSpendPanel() {
  const monthly = useMonthlyTotals();
  return (
    <Panel
      title="Income vs spend"
      actions={<span className={styles.meta}>Last {MONTHS} months</span>}
      flush
    >
      <PanelState
        query={monthly}
        skeleton={
          <div className={styles.pad}>
            <Skeleton lines={2} />
            <Skeleton height={200} />
          </div>
        }
        empty={(series) =>
          isQuietSeries(monthlyStats(series)) ? (
            <EmptyState
              compact
              title="No income or spend yet"
              description="Transactions you add will show up here by month."
            />
          ) : null
        }
      >
        {(series) => <Body stats={monthlyStats(series)} />}
      </PanelState>
    </Panel>
  );
}

function Body({ stats }: { stats: MonthlyStats }) {
  const { fmt } = usePreferences();
  const month = stats.current
    ? fmt.date(monthDate(stats.current.month), DateStyle.MonthYear).split(' ')[0]
    : '';
  return (
    <>
      <StatGroup label={`Income and spend, ${month}`}>
        <Stat
          label={`${month} income`}
          value={
            <Money
              amount={stats.current?.income ?? 0}
              sign={SignDisplay.Always}
              size={MoneySize.Medium}
            />
          }
        />
        <Stat
          label={`${month} spend`}
          value={
            <Money
              amount={-(stats.current?.spend ?? 0)}
              sign={SignDisplay.Always}
              size={MoneySize.Medium}
            />
          }
        />
        <Stat
          label={`${MONTHS}M avg spend`}
          value={
            <Money amount={stats.avgSpend ?? 0} sign={SignDisplay.Never} size={MoneySize.Medium} />
          }
        />
        <Stat
          label="Savings rate"
          value={
            <span className={styles.figure}>
              {stats.savingsRate == null ? '--' : fmt.percent(stats.savingsRate)}
            </span>
          }
          foot={stats.savingsRate == null ? 'No income this month' : undefined}
        />
      </StatGroup>
      <div className={styles.chart}>
        <BarChart
          title="Income and spend by month"
          height={220}
          labels={stats.months.map((m) => fmt.date(monthDate(m), DateStyle.MonthYear))}
          series={[
            { key: 'income', label: 'Income', values: stats.income, color: 'var(--viz-income)' },
            { key: 'spend', label: 'Spend', values: stats.spend, color: 'var(--viz-spend)' },
          ]}
        />
      </div>
    </>
  );
}
