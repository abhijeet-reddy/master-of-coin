import { ChevronLeft, ChevronRight, Triangle } from 'lucide-react';
import { toNumber } from '@/lib/format';
import { IconButton, Meter, Money, SignDisplay, Skeleton, Stat, StatGroup } from '@/ui';
import { useMonthTotals } from '../hooks/useTxQueries';
import type { TransactionFiltersApi } from '../hooks/useTransactionFilters';
import styles from './Transactions.module.css';
import { cx } from '@/ui/cx';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number);
  return { short: `${MONTHS[m - 1].slice(0, 3)} ${y}`, long: `${MONTHS[m - 1]} ${y}` };
}

/** Month navigation plus the month's income, spend and net (all accounts, transfers excluded). */
export function MonthBar({ f }: { f: TransactionFiltersApi }) {
  const { totals, isLoading, isError } = useMonthTotals(f.month);
  const label = monthLabel(f.month);
  const income = toNumber(totals?.income);
  const spend = toNumber(totals?.spend);
  const pct = income > 0 ? Math.round((spend / income) * 100) : null;
  const fig = (v: string | number | undefined, sign: SignDisplay) =>
    isLoading ? (
      <Skeleton width={90} height={18} />
    ) : isError || !totals ? (
      '--'
    ) : (
      <Money amount={v} sign={sign} />
    );

  return (
    <section className={cx(styles.monthbar, 'moc-sweep')} aria-label="Month">
      <MonthNav f={f} />
      <div className={styles.monthStats}>
        <StatGroup label={`${label.long} totals, all accounts, transfers excluded`}>
          <Stat
            label={
              <>
                <Triangle aria-hidden className={styles.statIcon} fill="currentColor" />
                Income
              </>
            }
            value={fig(income, SignDisplay.Always)}
          />
          <Stat
            label={
              <>
                <Triangle
                  aria-hidden
                  className={styles.statIcon}
                  fill="currentColor"
                  transform="rotate(180)"
                />
                Spend
              </>
            }
            value={fig(-spend, SignDisplay.Always)}
          />
          <Stat
            label="Net"
            value={fig(totals?.net, SignDisplay.Always)}
            foot="All accounts, no transfers"
          />
          <Stat
            label="Spend of income"
            value={pct == null ? '--' : `${pct}%`}
            foot={
              pct == null ? (
                'No income yet'
              ) : (
                <Meter percent={pct} label="Spend as a share of income" />
              )
            }
          />
        </StatGroup>
      </div>
    </section>
  );
}

/** Previous / next month with the month label. Also used alone on the account ledger. */
export function MonthNav({ f }: { f: TransactionFiltersApi }) {
  const label = monthLabel(f.month);
  return (
    <div className={styles.monthnav}>
      <IconButton
        className={styles.navBtn}
        label="Previous month"
        icon={<ChevronLeft />}
        onClick={() => f.goMonth(-1)}
      />
      <div className={styles.monthLabel} aria-live="polite">
        <b>
          <span className="sr-only">{label.long}</span>
          <span aria-hidden>{label.short}</span>
        </b>
        <span>
          {f.rangeActive ? 'Custom date range' : f.isCurrentMonth ? 'Current month' : 'Past month'}
        </span>
      </div>
      <IconButton
        className={styles.navBtn}
        label="Next month"
        icon={<ChevronRight />}
        onClick={() => f.goMonth(1)}
        disabled={f.isCurrentMonth && !f.rangeActive}
      />
    </div>
  );
}
