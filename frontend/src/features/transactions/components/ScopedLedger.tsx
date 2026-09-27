import { useMemo } from 'react';
import type { Crumb } from '@/app/shell/routeMeta';
import { useBulkSelection } from '@/lib/useBulkSelection';
import { useTransactionFilters, type LedgerScope } from '../hooks/useTransactionFilters';
import { useTxDrawer } from '../hooks/useTxDrawer';
import { useLedgerContext, useTransactionList } from '../hooks/useTxQueries';
import { Money, SignDisplay, Skeleton, Stat, StatGroup } from '@/ui';
import { groupByDay, scopedFlows } from '../lib/ledger';
import { TxOriginContext } from '../lib/txOrigin';
import { BulkBar } from './BulkBar';
import { TxDialogsProvider } from './dialogs/TxDialogsProvider';
import { FilterRail } from './FilterRail';
import { Ledger } from './Ledger';
import { MonthNav } from './MonthBar';
import { TxDrawer } from './TxDrawer';
import styles from './Transactions.module.css';
import { cx } from '@/ui/cx';

interface ScopedProps {
  origin: Crumb[];
  scope: LedgerScope;
  monthLabel: string;
}

/**
 * The ledger pinned to one category or one person: month navigation, the
 * filter rail without the pinned filter, day groups, the `?tx=` drawer and
 * bulk delete. Rows opened from here crumb back to the hosting page.
 */
function ScopedLedger({ origin, scope, monthLabel }: ScopedProps) {
  return (
    <TxOriginContext.Provider value={origin}>
      <TxDialogsProvider>
        <ScopedLedgerView scope={scope} monthLabel={monthLabel} />
      </TxDialogsProvider>
    </TxOriginContext.Provider>
  );
}

function ScopedLedgerView({ scope, monthLabel }: Omit<ScopedProps, 'origin'>) {
  const f = useTransactionFilters(scope);
  const query = useTransactionList(f.params);
  const ctx = useLedgerContext();
  const selection = useBulkSelection();
  const drawer = useTxDrawer();
  const rows = query.data?.data;
  const groups = useMemo(() => (rows && ctx.ready ? groupByDay(rows, ctx) : []), [rows, ctx]);
  const complete = !!query.data && query.data.pagination.total <= query.data.data.length;
  const flows = useMemo(
    () => (rows && ctx.ready && complete ? scopedFlows(rows, ctx) : null),
    [rows, ctx, complete]
  );
  const loading = query.isLoading || (!!rows && !ctx.ready);
  const fig = (v: number | undefined) =>
    loading ? (
      <Skeleton width={90} height={18} />
    ) : v === undefined ? (
      '--'
    ) : (
      <Money amount={v} currency={ctx.base} sign={SignDisplay.Always} />
    );
  const foot = !flows
    ? loading
      ? undefined
      : 'Too many rows to total'
    : flows.missing.length
      ? `No rate for ${flows.missing.join(', ')}`
      : `${flows.count} txn, filters applied`;
  return (
    <div className={styles.page}>
      <section className={cx(styles.monthbar, 'moc-sweep')} aria-label={monthLabel}>
        <MonthNav f={f} />
        <div className={styles.monthStats}>
          <StatGroup label={`${scope.summaryLabel ?? 'These transactions'}, in ${ctx.base}`}>
            <Stat label="Money in" value={fig(flows?.in)} />
            <Stat label="Money out" value={fig(flows?.out)} />
            <Stat label="Net" value={fig(flows?.net)} foot={foot} />
          </StatGroup>
        </div>
      </section>
      <div className={styles.rl}>
        <FilterRail f={f} />
        <Ledger
          f={f}
          groups={groups}
          query={{ ...query, isLoading: query.isLoading || (!!rows && !ctx.ready) }}
          base={ctx.base}
          selection={selection}
          onOpen={drawer.open}
        />
      </div>
      <BulkBar selection={selection} />
      <TxDrawer />
    </div>
  );
}

export interface CategoryLedgerProps {
  category: { id: string; name: string };
}

/** Every transaction in one category, month by month. */
export function CategoryLedger({ category }: CategoryLedgerProps) {
  const { id, name } = category;
  const origin = useMemo(
    () => [
      { label: 'Categories', to: '/categories' },
      { label: name, to: `/categories/${id}` },
    ],
    [id, name]
  );
  const scope = useMemo<LedgerScope>(
    () => ({
      categoryId: id,
      canAdd: false,
      emptyNote: `Nothing in ${name} this month.`,
      summaryLabel: `${name} totals`,
    }),
    [id, name]
  );
  return <ScopedLedger origin={origin} scope={scope} monthLabel="Month" />;
}

export interface PersonLedgerProps {
  person: { id: string; name: string };
}

/** Transactions split with, or paid by, one person, month by month. */
export function PersonLedger({ person }: PersonLedgerProps) {
  const { id, name } = person;
  const origin = useMemo(
    () => [
      { label: 'People', to: '/people' },
      { label: name, to: `/people/${id}` },
    ],
    [id, name]
  );
  const scope = useMemo<LedgerScope>(
    () => ({
      personId: id,
      canAdd: false,
      emptyNote: `Nothing shared with ${name} this month.`,
      summaryLabel: `Shared with ${name}, totals`,
    }),
    [id, name]
  );
  return <ScopedLedger origin={origin} scope={scope} monthLabel="Month" />;
}
