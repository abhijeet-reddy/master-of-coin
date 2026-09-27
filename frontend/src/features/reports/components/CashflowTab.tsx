import { AreaChart, BarChart } from '@/charts';
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
import type { MonthlyTotals, SpendingTrendDay } from '@/api/types/analytics';
import { monthDate } from '@/features/dashboard/lib/dashboardModel';
import { useDailySpend, useMonthlyInRange } from '../hooks/useReportQueries';
import {
  daysIn,
  MAX_MONTHS,
  MAX_TREND_DAYS,
  partialMonths,
  type DateRange,
} from '../lib/reportRange';
import {
  cashflowText,
  cashflowTotals,
  isQuiet,
  signFor,
  trendStats,
  trendText,
} from '../lib/reportsModel';
import styles from './Reports.module.css';

const chartSkeleton = (
  <div className={styles.pad}>
    <Skeleton lines={2} />
    <Skeleton height={200} />
  </div>
);

/** Income against spend for each month of the period, then spend day by day. */
export function CashflowTab({ range }: { range: DateRange }) {
  return (
    <div className={styles.tabBody}>
      <MonthlyPanel range={range} />
      <DailyPanel range={range} />
    </div>
  );
}

function MonthlyPanel({ range }: { range: DateRange }) {
  const { query, clipped } = useMonthlyInRange(range);
  return (
    <Panel title="Income and spend" actions={<span className={styles.meta}>By month</span>} flush>
      <PanelState
        query={query}
        skeleton={chartSkeleton}
        empty={(series) =>
          isQuiet(cashflowTotals(series)) ? (
            <EmptyState
              compact
              title="No income or spend in this period"
              description="Pick a longer period, or add transactions."
            />
          ) : null
        }
      >
        {(series) => <MonthlyBody series={series} />}
      </PanelState>
      {partialMonths(range) || clipped ? (
        <p className={styles.note}>
          {partialMonths(range)
            ? 'Monthly totals cover whole calendar months, so the first and last months count in full. '
            : ''}
          {clipped ? `Only the latest ${MAX_MONTHS} months are available.` : ''}
        </p>
      ) : null}
    </Panel>
  );
}

function MonthlyBody({ series }: { series: MonthlyTotals[] }) {
  const { fmt } = usePreferences();
  const t = cashflowTotals(series);
  const label = (m: string) => fmt.date(monthDate(m), DateStyle.MonthYear);
  return (
    <>
      <StatGroup label="Period totals">
        <Stat
          label="Income"
          value={<Money amount={t.income} sign={SignDisplay.Always} size={MoneySize.Medium} />}
          foot={`${fmt.money(t.avgIncome)} a month`}
        />
        <Stat
          label="Spend"
          value={<Money amount={-t.spend} sign={SignDisplay.Always} size={MoneySize.Medium} />}
          foot={`${fmt.money(t.avgSpend)} a month`}
        />
        <Stat
          label="Net"
          value={<Money amount={t.net} sign={signFor(t.net)} size={MoneySize.Medium} />}
        />
        <Stat
          label="Savings rate"
          value={
            <span className={styles.figure}>
              {t.savingsRate == null ? '--' : fmt.percent(t.savingsRate)}
            </span>
          }
          foot={t.savingsRate == null ? 'No income in this period' : undefined}
        />
      </StatGroup>
      <div className={styles.chart}>
        <BarChart
          title="Income and spend by month"
          height={220}
          labels={series.map((m) => label(m.month))}
          series={[
            {
              key: 'income',
              label: 'Income',
              values: series.map((m) => Number(m.income) || 0),
              color: 'var(--viz-income)',
            },
            {
              key: 'spend',
              label: 'Spend',
              values: series.map((m) => Number(m.spend) || 0),
              color: 'var(--viz-spend)',
            },
          ]}
        />
        <p className={styles.summary}>{cashflowText(t, fmt)}</p>
      </div>
      <div className={styles.tableWrap}>
        <Table caption="Income, spend and net by month">
          <thead>
            <tr>
              <Th>Month</Th>
              <Th align={CellAlign.End}>Income</Th>
              <Th align={CellAlign.End}>Spend</Th>
              <Th align={CellAlign.End}>Net</Th>
            </tr>
          </thead>
          <tbody>
            {[...series].reverse().map((m) => {
              const net = Number(m.net) || 0;
              return (
                <Tr key={m.month}>
                  <Td>{label(m.month)}</Td>
                  <Td align={CellAlign.End}>
                    <Money amount={m.income} sign={SignDisplay.Never} />
                  </Td>
                  <Td align={CellAlign.End}>
                    <Money amount={m.spend} sign={SignDisplay.Never} />
                  </Td>
                  <Td align={CellAlign.End}>
                    <Money amount={net} sign={signFor(net)} />
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    </>
  );
}

function DailyPanel({ range }: { range: DateRange }) {
  const { query, window } = useDailySpend(range);
  return (
    <Panel title="Daily spend" actions={<span className={styles.meta}>Per day</span>} flush>
      <PanelState query={query} skeleton={chartSkeleton}>
        {(days) => <DailyBody days={days} dayCount={daysIn(window.range)} />}
      </PanelState>
      {window.clipped ? (
        <p className={styles.note}>
          Daily spend covers the last {MAX_TREND_DAYS} days of the period.
        </p>
      ) : null}
    </Panel>
  );
}

function DailyBody({ days, dayCount }: { days: SpendingTrendDay[]; dayCount: number }) {
  const { fmt } = usePreferences();
  const s = trendStats(days);
  if (s.total === 0) {
    return <EmptyState compact title="No spending in this period" />;
  }
  return (
    <>
      <StatGroup label="Daily spend">
        <Stat
          label="Total spend"
          value={<Money amount={s.total} sign={SignDisplay.Never} size={MoneySize.Medium} />}
        />
        <Stat
          label="Per day"
          value={<Money amount={s.perDay} sign={SignDisplay.Never} size={MoneySize.Medium} />}
          foot={`${s.activeDays} of ${dayCount} days with spend`}
        />
        <Stat
          label="Biggest day"
          value={
            <Money amount={s.peak?.amount ?? 0} sign={SignDisplay.Never} size={MoneySize.Medium} />
          }
          foot={s.peak ? fmt.date(s.peak.date) : undefined}
        />
      </StatGroup>
      <div className={styles.chart}>
        <AreaChart
          title="Spend per day"
          height={200}
          data={days.map((d) => ({ label: fmt.date(d.date), value: Number(d.amount) || 0 }))}
        />
        <p className={styles.summary}>{trendText(s, dayCount, fmt)}</p>
      </div>
    </>
  );
}
