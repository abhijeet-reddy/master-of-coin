import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Budget, BudgetRange } from '@/api/types';
import { PaceChart } from '@/charts';
import { DateStyle } from '@/lib/format';
import { usePreferences } from '@/lib/preferences';
import {
  Badge,
  Button,
  buttonClass,
  ButtonVariant,
  CellAlign,
  ControlSize,
  EmptyState,
  ErrorState,
  IconButton,
  Panel,
  Skeleton,
  Table,
  Td,
  Th,
  Tone,
  Tr,
} from '@/ui';
import { useBudgetDialogs } from '../hooks/budgetDialogs';
import { useAccounts, useBudgetRanges, usePeriodSpend } from '../hooks/useBudgetQueries';
import {
  currentRange,
  PERIOD_LABEL,
  paceSeries,
  sortRanges,
  spendOf,
  type BudgetStats,
} from '../lib/budgetsModel';
import styles from './Budgets.module.css';

const windowOf = (s: BudgetStats) =>
  s.active && s.start && s.end ? { start: s.start, end: s.end } : null;

/** Cumulative spend in the current period against the straight line to the limit. */
export function PacePanel({ s }: { s: BudgetStats }) {
  const { fmt } = usePreferences();
  const txs = usePeriodSpend(windowOf(s), s.budget.filters);
  const series = useMemo(
    () =>
      s.start && s.end
        ? paceSeries(s.start, s.end, s.elapsed, txs.data?.data ?? [], s.spent)
        : { days: [], actual: [] },
    [s.start, s.end, s.elapsed, s.spent, txs.data]
  );
  const labels = useMemo(
    () => series.days.map((d) => fmt.date(d, DateStyle.DayMonth)),
    [series.days, fmt]
  );
  const title = 'Pace this period';
  if (!s.active)
    return (
      <Panel title={title}>
        <EmptyState
          compact
          title="No active range"
          description="Add a range to see this period's pace."
        />
      </Panel>
    );
  return (
    <Panel
      title={title}
      actions={
        <span className={styles.micro}>
          day {s.elapsed} of {s.totalDays}
        </span>
      }
    >
      {txs.error ? (
        <ErrorState
          compact
          error={txs.error}
          title="Could not load this period's spending"
          onRetry={() => void txs.refetch()}
        />
      ) : !txs.data ? (
        <div aria-busy="true">
          <span className="sr-only">Loading</span>
          <Skeleton height={220} />
        </div>
      ) : (
        <PaceChart
          title={`${s.name}: spend against the pace line to ${fmt.money(s.limit, s.currency)}`}
          labels={labels}
          actual={series.actual}
          limit={s.limit}
          height={220}
          format={(n) => fmt.money(n, s.currency)}
          axisFormat={(n) => fmt.money(n, s.currency, { compact: true })}
        />
      )}
    </Panel>
  );
}

function rangeSpan(r: BudgetRange, date: (d: string) => string) {
  return `${date(r.start_date)} to ${r.end_date ? date(r.end_date) : 'open ended'}`;
}

/** Every stored range, newest first, with add, edit and delete. `compact` is the list page's read-only view. */
export function RangeHistory({ budget, compact = false }: { budget: Budget; compact?: boolean }) {
  const { fmt } = usePreferences();
  const dialogs = useBudgetDialogs();
  const ranges = useBudgetRanges(budget.id);
  const date = (d: string) => fmt.date(d, DateStyle.Medium);

  if (ranges.error)
    return (
      <ErrorState
        compact
        error={ranges.error}
        title="Could not load the ranges"
        onRetry={() => void ranges.refetch()}
      />
    );
  if (!ranges.data)
    return (
      <div aria-busy="true">
        <span className="sr-only">Loading</span>
        <Skeleton lines={3} height={14} />
      </div>
    );
  const list = sortRanges(ranges.data);
  const current = list.find((r) => r.id === budget.active_range?.id) ?? currentRange(list);
  if (!list.length)
    return (
      <EmptyState
        compact
        title="No ranges"
        description="A range sets the limit and period from a start date."
        action={
          compact ? undefined : (
            <Button icon={<Plus aria-hidden />} onClick={() => dialogs.openRange(budget)}>
              Add range
            </Button>
          )
        }
      />
    );
  const shown = compact ? list.slice(0, 3) : list;
  return (
    <Table caption={`${budget.name} ranges`} hideCaption>
      <thead>
        <tr>
          <Th>Range</Th>
          {compact ? null : <Th>Period</Th>}
          <Th align={CellAlign.End}>Limit</Th>
          {compact ? null : (
            <Th align={CellAlign.End}>
              <span className="sr-only">Actions</span>
            </Th>
          )}
        </tr>
      </thead>
      <tbody>
        {shown.map((r) => {
          const span = rangeSpan(r, date);
          return (
            <Tr key={r.id}>
              <Td>
                <span className={styles.rangeCell}>
                  {span}
                  {r.id === current?.id ? <Badge tone={Tone.Accent}>Current</Badge> : null}
                  {compact ? <span className={styles.micro}>{PERIOD_LABEL[r.period]}</span> : null}
                </span>
              </Td>
              {compact ? null : <Td>{PERIOD_LABEL[r.period]}</Td>}
              <Td align={CellAlign.End}>
                {fmt.money(Number(r.limit_amount), budget.currency ?? undefined)}
              </Td>
              {compact ? null : (
                <Td align={CellAlign.End}>
                  <span className={styles.rangeActions}>
                    <IconButton
                      size={ControlSize.Sm}
                      label={`Edit range ${span}`}
                      icon={<Pencil aria-hidden />}
                      onClick={() => dialogs.openRange(budget, r)}
                    />
                    <IconButton
                      size={ControlSize.Sm}
                      label={`Delete range ${span}`}
                      icon={<Trash2 aria-hidden />}
                      onClick={() => dialogs.confirmDeleteRange(budget, r)}
                    />
                  </span>
                </Td>
              )}
            </Tr>
          );
        })}
      </tbody>
      {compact && list.length > shown.length ? (
        <tfoot>
          <tr>
            <Td colSpan={2} className={styles.micro}>
              {list.length - shown.length} earlier on the budget page
            </Td>
          </tr>
        </tfoot>
      ) : null}
    </Table>
  );
}

export function RangeHistoryPanel({ budget }: { budget: Budget }) {
  const dialogs = useBudgetDialogs();
  const ranges = useBudgetRanges(budget.id);
  const newest = ranges.data ? sortRanges(ranges.data)[0] : undefined;
  return (
    <Panel
      title="Range history"
      actions={
        <Button
          size={ControlSize.Sm}
          icon={<Plus aria-hidden />}
          onClick={() => dialogs.openRange(budget, undefined, newest)}
          disabled={!ranges.data}
        >
          Add range
        </Button>
      }
    >
      <RangeHistory budget={budget} />
    </Panel>
  );
}

/** The latest few transactions counting toward the budget, for the list page's side panel. */
export function CountingList({ s }: { s: BudgetStats }) {
  const { fmt } = usePreferences();
  const txs = usePeriodSpend(windowOf(s), s.budget.filters);
  const accounts = useAccounts();
  const cur = useMemo(
    () => new Map((accounts.data ?? []).map((a) => [a.id, String(a.currency)])),
    [accounts.data]
  );
  if (!s.active) return null;
  if (txs.error) return <ErrorState compact error={txs.error} onRetry={() => void txs.refetch()} />;
  if (!txs.data)
    return (
      <div aria-busy="true">
        <span className="sr-only">Loading</span>
        <Skeleton lines={3} height={14} />
      </div>
    );
  const list = txs.data.data.filter((t) => spendOf(t) > 0).slice(0, 4);
  if (!list.length) return <p className={styles.micro}>Nothing counted yet this period.</p>;
  return (
    <>
      <ul className={`${styles.txList} moc-stagger`}>
        {list.map((t) => (
          <li key={t.id}>
            <span className={styles.micro}>{fmt.date(t.date, DateStyle.DayMonth)}</span>
            <span className={styles.txTitle}>{t.title}</span>
            <span className={styles.txAmt}>{fmt.money(-spendOf(t), cur.get(t.account_id))}</span>
          </li>
        ))}
      </ul>
      <p className={styles.micro}>
        Latest {list.length} of {txs.data.pagination.total}.{' '}
        <Link to={`/budgets/${s.id}`} className={buttonClass(ButtonVariant.Ghost, ControlSize.Sm)}>
          All transactions
        </Link>
      </p>
    </>
  );
}
