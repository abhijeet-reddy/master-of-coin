import { ArrowLeftRight, NotebookText, Split } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DateStyle, SignDisplay } from '@/lib/format';
import { convert } from '@/lib/fx';
import { usePreferences } from '@/lib/preferences';
import {
  Badge,
  ButtonVariant,
  CellAlign,
  ControlSize,
  EmptyState,
  Money,
  Panel,
  Skeleton,
  Table,
  Td,
  Th,
  Tr,
  buttonClass,
} from '@/ui';
import {
  useAccountList,
  useCategoryList,
  useRates,
  useSummary,
} from '../hooks/useDashboardQueries';
import { combineQueries } from '@/lib/panelQuery';
import { activityRows, type ActivityRow } from '../lib/dashboardModel';
import { usePeople } from '@/features/transactions/hooks/useTxQueries';
import { byId } from '@/features/transactions/lib/ledger';
import type { RateTable } from '@/lib/fx';
import { PanelState } from '@/ui/PanelState';
import styles from './Dashboard.module.css';

/** The latest transactions; each title opens the transaction. */
export function RecentActivityPanel() {
  const query = combineQueries(useSummary(), useAccountList(), useCategoryList());
  const people = usePeople();
  const { prefs } = usePreferences();
  const base = prefs.default_currency;
  const foreign = (query.data?.[1] ?? []).some((a) => String(a.currency) !== base);
  const rates = useRates(base, foreign);
  const table: RateTable | null = rates.data?.conversion_rates
    ? { base, rates: rates.data.conversion_rates }
    : null;
  return (
    <Panel
      title="Recent activity"
      actions={
        <Link to="/transactions" className={buttonClass(ButtonVariant.Ghost, ControlSize.Sm)}>
          View all
        </Link>
      }
      flush
    >
      <PanelState
        query={query}
        skeleton={
          <div className={styles.pad}>
            <Skeleton lines={8} height={14} />
          </div>
        }
        empty={([s]) =>
          s.recent_transactions.length === 0 ? (
            <EmptyState
              compact
              title="No transactions yet"
              action={
                <Link
                  to="/transactions"
                  className={buttonClass(ButtonVariant.Primary, ControlSize.Sm)}
                >
                  Go to transactions
                </Link>
              }
            />
          ) : null
        }
      >
        {([s, accounts, categories]) => (
          <ActivityTable
            rows={activityRows(s.recent_transactions, accounts, categories, byId(people.data))}
            rates={table}
          />
        )}
      </PanelState>
    </Panel>
  );
}

function ActivityTable({ rows, rates }: { rows: ActivityRow[]; rates: RateTable | null }) {
  const { fmt, prefs } = usePreferences();
  const base = prefs.default_currency;
  return (
    <Table caption="Recent transactions" hideCaption>
      <thead>
        <tr>
          <Th className={styles.wideOnly}>Date</Th>
          <Th>Title</Th>
          <Th className={styles.wideOnly}>Category</Th>
          <Th className={styles.wideOnly}>Account</Th>
          <Th align={CellAlign.End}>Amount</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const eq =
            r.currency && r.currency !== base ? convert(r.amount, r.currency, base, rates) : null;
          return (
            <Tr key={r.id} clickable>
              <Td className={`${styles.nowrap} ${styles.wideOnly}`}>
                {fmt.date(r.date, DateStyle.DayMonth)}
              </Td>
              <Td>
                <Link to={`/transactions/${r.id}`} className={styles.txTitle}>
                  {r.title}
                </Link>
                <span className={styles.narrowOnly}>
                  {fmt.date(r.date, DateStyle.DayMonth)}, {r.accountName}
                </span>
                <TxBadges row={r} />
              </Td>
              <Td className={styles.wideOnly}>
                {r.categoryName ? (
                  <span className={styles.cat}>
                    <i
                      className={styles.swatch}
                      style={{ background: r.categoryColor ?? 'var(--viz-other)' }}
                      aria-hidden
                    />
                    {r.categoryName}
                  </span>
                ) : (
                  <span className={styles.dim}>Uncategorised</span>
                )}
              </Td>
              <Td className={styles.wideOnly}>{r.accountName}</Td>
              <Td align={CellAlign.End}>
                <Money
                  amount={r.amount}
                  currency={r.currency || undefined}
                  sign={SignDisplay.Always}
                  converted={eq != null ? { amount: eq, currency: base } : null}
                />
              </Td>
            </Tr>
          );
        })}
      </tbody>
    </Table>
  );
}

function TxBadges({ row }: { row: ActivityRow }) {
  if (!row.split && !row.transferTo && !row.hasNote) return null;
  return (
    <span className={styles.badges}>
      {row.split ? (
        <Badge icon={<Split aria-hidden />}>
          Split {row.split.name}
          {row.split.count > 1 ? ` +${row.split.count - 1}` : ''}
        </Badge>
      ) : null}
      {row.transferTo ? (
        <Badge icon={<ArrowLeftRight aria-hidden />}>Transfer {row.transferTo}</Badge>
      ) : null}
      {row.hasNote ? <Badge icon={<NotebookText aria-hidden />}>Note</Badge> : null}
    </span>
  );
}
