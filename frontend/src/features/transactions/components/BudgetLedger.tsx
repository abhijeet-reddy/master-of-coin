import { useMemo } from 'react';
import { useBulkSelection } from '@/lib/useBulkSelection';
import { useTransactionFilters } from '../hooks/useTransactionFilters';
import { useTxDrawer } from '../hooks/useTxDrawer';
import { useLedgerContext, useTransactionList } from '../hooks/useTxQueries';
import { groupByDay } from '../lib/ledger';
import { TxOriginContext } from '../lib/txOrigin';
import { BulkBar } from './BulkBar';
import { TxDialogsProvider } from './dialogs/TxDialogsProvider';
import { Ledger } from './Ledger';
import { TxDrawer } from './TxDrawer';
import styles from './Transactions.module.css';

export interface BudgetLedgerProps {
  budget: { id: string; name: string };
  /** The current period, `YYYY-MM-DD` inclusive, as the server counts it (UTC days). */
  start: string;
  end: string;
  categoryId?: string;
  accountId?: string;
}

/**
 * The spending that counts toward a budget this period: money out in the
 * budget's window, narrowed to its category and account. No month navigation
 * or filter rail; the `?tx=` drawer and bulk delete work as on the ledger.
 */
export function BudgetLedger(props: BudgetLedgerProps) {
  const { id, name } = props.budget;
  const origin = useMemo(
    () => [
      { label: 'Budgets', to: '/budgets' },
      { label: name, to: `/budgets/${id}` },
    ],
    [id, name]
  );
  return (
    <TxOriginContext.Provider value={origin}>
      <TxDialogsProvider>
        <BudgetLedgerView {...props} />
      </TxDialogsProvider>
    </TxOriginContext.Provider>
  );
}

function BudgetLedgerView({ start, end, categoryId, accountId }: BudgetLedgerProps) {
  const f = useTransactionFilters({
    accountId,
    categoryId,
    canAdd: false,
    sign: 'negative',
    window: { start_date: `${start}T00:00:00Z`, end_date: `${end}T23:59:59Z` },
    emptyNote: 'Nothing spent toward this budget in the current period.',
  });
  const query = useTransactionList(f.params);
  const ctx = useLedgerContext();
  const selection = useBulkSelection();
  const drawer = useTxDrawer();
  const rows = query.data?.data;
  const groups = useMemo(() => (rows && ctx.ready ? groupByDay(rows, ctx) : []), [rows, ctx]);

  return (
    <div className={styles.page}>
      <Ledger
        f={f}
        groups={groups}
        query={{ ...query, isLoading: query.isLoading || (!!rows && !ctx.ready) }}
        base={ctx.base}
        selection={selection}
        onOpen={drawer.open}
      />
      <BulkBar selection={selection} />
      <TxDrawer />
    </div>
  );
}
