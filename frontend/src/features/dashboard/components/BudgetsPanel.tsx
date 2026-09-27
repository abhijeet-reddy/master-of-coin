import { CircleCheck, OctagonAlert, TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BudgetHealth } from '@/api/types';
import { usePreferences } from '@/lib/preferences';
import {
  Badge,
  ButtonVariant,
  ControlSize,
  EmptyState,
  Meter,
  Money,
  Panel,
  Skeleton,
  buttonClass,
} from '@/ui';
import { useSummary } from '../hooks/useDashboardQueries';
import { budgetRows, healthLabel, healthTone, type BudgetRow } from '../lib/dashboardModel';
import { PanelState } from '@/ui/PanelState';
import styles from './Dashboard.module.css';

const HEALTH_ICON = {
  [BudgetHealth.OnTrack]: CircleCheck,
  [BudgetHealth.Warning]: TriangleAlert,
  [BudgetHealth.Over]: OctagonAlert,
};

/** The four most-used budgets, each with a pace tick for time elapsed. */
export function BudgetsPanel() {
  const summary = useSummary();
  const count = summary.data?.budget_statuses.length;
  return (
    <Panel
      title="Budgets"
      actions={
        <Link to="/budgets" className={buttonClass(ButtonVariant.Ghost, ControlSize.Sm)}>
          {count ? `All ${count}` : 'Budgets'}
        </Link>
      }
    >
      <PanelState
        query={summary}
        skeleton={<Skeleton lines={8} height={12} />}
        empty={(s) =>
          s.budget_statuses.length === 0 ? (
            <EmptyState
              compact
              title="No budgets yet"
              description="Set a limit on a category to see how you are pacing."
              action={
                <Link to="/budgets" className={buttonClass(ButtonVariant.Primary, ControlSize.Sm)}>
                  Create a budget
                </Link>
              }
            />
          ) : null
        }
      >
        {(s) => <BudgetList statuses={s.budget_statuses} />}
      </PanelState>
    </Panel>
  );
}

function BudgetList({ statuses }: { statuses: Parameters<typeof budgetRows>[0] }) {
  const rows = useMemo(() => budgetRows(statuses, new Date()), [statuses]);
  return (
    <div className={styles.stack}>
      <ul className={`${styles.budgets} moc-stagger`}>
        {rows.map((b) => (
          <BudgetItem key={b.id} row={b} />
        ))}
      </ul>
      <p className={styles.note}>
        <span className={styles.tick} aria-hidden /> Tick marks time elapsed in the period
      </p>
    </div>
  );
}

function BudgetItem({ row }: { row: BudgetRow }) {
  const { fmt } = usePreferences();
  const Icon = HEALTH_ICON[row.health] ?? CircleCheck;
  const days = `${row.daysLeft}d left`;
  return (
    <li className={styles.budget}>
      <div className={styles.budgetHead}>
        <Link to={`/budgets/${row.id}`} className={styles.budgetName}>
          {row.name}
        </Link>
        <Badge tone={healthTone(row.health)} icon={<Icon aria-hidden />}>
          {healthLabel(row.health)}
        </Badge>
      </div>
      <Meter
        percent={row.percent}
        pace={row.pace ?? undefined}
        tone={healthTone(row.health)}
        label={`${row.name} budget`}
        caption={
          <>
            <span>
              <Money amount={row.spent} currency={row.currency} /> of{' '}
              <Money amount={row.limit} currency={row.currency} />
            </span>
            <span>
              {fmt.percent(row.percent)} / {days}
            </span>
          </>
        }
      />
    </li>
  );
}
