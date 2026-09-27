import { useMemo } from 'react';
import { PageActions } from '@/app/shell/PageActions';
import { useBulkSelection } from '@/lib/useBulkSelection';
import { BulkBar } from '../components/BulkBar';
import { TxDialogsProvider } from '../components/dialogs/TxDialogsProvider';
import { EntryButtons } from '../components/EntryButtons';
import { FilterRail } from '../components/FilterRail';
import { Ledger } from '../components/Ledger';
import { MonthBar } from '../components/MonthBar';
import { TxDrawer } from '../components/TxDrawer';
import { useTransactionFilters } from '../hooks/useTransactionFilters';
import { useTxDrawer } from '../hooks/useTxDrawer';
import { useLedgerContext, useTransactionList } from '../hooks/useTxQueries';
import { groupByDay } from '../lib/ledger';
import styles from '../components/Transactions.module.css';

/** `/transactions`: month bar, filter rail, day-grouped ledger, `?tx=` drawer, bulk delete. */
export function TransactionsPage() {
  return (
    <TxDialogsProvider>
      <TransactionsView />
    </TxDialogsProvider>
  );
}

function TransactionsView() {
  const f = useTransactionFilters();
  const query = useTransactionList(f.params);
  const ctx = useLedgerContext();
  const selection = useBulkSelection();
  const drawer = useTxDrawer();
  const rows = query.data?.data;
  const groups = useMemo(() => (rows && ctx.ready ? groupByDay(rows, ctx) : []), [rows, ctx]);

  return (
    <div className={styles.page}>
      <PageActions>
        <EntryButtons />
      </PageActions>
      <MonthBar f={f} />
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
