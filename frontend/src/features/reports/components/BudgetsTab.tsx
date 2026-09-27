import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { DashboardBudgetStatus } from '@/api/types';
import { usePreferences } from '@/lib/preferences';
import {
  Badge,
  ButtonVariant,
  CellAlign,
  ControlSize,
  EmptyState,
  Meter,
  Money,
  Panel,
  PanelState,
  Skeleton,
  Table,
  Td,
  Th,
  Tr,
  buttonClass,
} from '@/ui';
import { useSummary } from '@/features/dashboard/hooks/useDashboardQueries';
import {
  budgetRows,
  healthLabel,
  healthTone,
  type BudgetRow,
} from '@/features/dashboard/lib/dashboardModel';
import { budgetCountText } from '../lib/reportsModel';
import styles from './Reports.module.css';

/** Every budget in its current period, most used first, each in its own currency. */
export function BudgetsTab() {
  const summary = useSummary();
  return (
    <div className={styles.tabBody}>
      <Panel title="Budgets" actions={<span className={styles.meta}>Current period</span>} flush>
        <PanelState
          query={summary}
          skeleton={
            <div className={styles.pad}>
              <Skeleton lines={6} height={12} />
            </div>
          }
          empty={(s) =>
            s.budget_statuses.length === 0 ? (
              <EmptyState
                compact
                title="No budgets yet"
                description="Set a limit on a category to see how you are pacing."
                action={
                  <Link
                    to="/budgets"
                    className={buttonClass(ButtonVariant.Primary, ControlSize.Sm)}
                  >
                    Create a budget
                  </Link>
                }
              />
            ) : null
          }
        >
          {(s) => <BudgetTable statuses={s.budget_statuses} />}
        </PanelState>
      </Panel>
    </div>
  );
}

function BudgetTable({ statuses }: { statuses: DashboardBudgetStatus[] }) {
  const rows = useMemo(() => budgetRows(statuses, new Date(), statuses.length), [statuses]);
  return (
    <>
      <p className={`${styles.summary} ${styles.pad}`}>{budgetCountText(rows)}</p>
      <div className={styles.tableWrap}>
        <Table caption="Budgets in their current period">
          <thead>
            <tr>
              <Th>Budget</Th>
              <Th>Used</Th>
              <Th align={CellAlign.End}>Spent</Th>
              <Th align={CellAlign.End} className={styles.wideOnly}>
                Limit
              </Th>
              <Th className={styles.wideOnly}>Status</Th>
              <Th align={CellAlign.End} className={styles.wideOnly}>
                Days left
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <BudgetLine key={r.id} row={r} />
            ))}
          </tbody>
        </Table>
      </div>
      <p className={styles.note}>
        Each budget is shown in its own currency. The tick on each bar marks time elapsed in the
        period.
      </p>
    </>
  );
}

function BudgetLine({ row }: { row: BudgetRow }) {
  const { fmt } = usePreferences();
  return (
    <Tr>
      <Td>
        <Link to={`/budgets/${row.id}`} className={styles.name}>
          {row.name}
        </Link>
      </Td>
      <Td>
        <div className={styles.meterCell}>
          <Meter
            percent={row.percent}
            pace={row.pace ?? undefined}
            tone={healthTone(row.health)}
            label={`${row.name} budget`}
            caption={<span>{fmt.percent(row.percent)}</span>}
          />
        </div>
      </Td>
      <Td align={CellAlign.End}>
        <Money amount={row.spent} currency={row.currency} />
      </Td>
      <Td align={CellAlign.End} className={styles.wideOnly}>
        <Money amount={row.limit} currency={row.currency} />
      </Td>
      <Td className={styles.wideOnly}>
        <Badge tone={healthTone(row.health)}>{healthLabel(row.health)}</Badge>
      </Td>
      <Td align={CellAlign.End} className={styles.wideOnly}>
        {row.daysLeft}
      </Td>
    </Tr>
  );
}
