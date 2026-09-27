import { useMemo } from 'react';
import { PageActions } from '@/app/shell/PageActions';
import type { Account } from '@/api/types';
import { useBulkSelection } from '@/lib/useBulkSelection';
import { Money, SignDisplay, Skeleton, Stat, StatGroup } from '@/ui';
import { useTransactionFilters } from '../hooks/useTransactionFilters';
import { useTxDrawer } from '../hooks/useTxDrawer';
import { useLedgerContext, useTransactionList } from '../hooks/useTxQueries';
import { accountFlows, groupByDay } from '../lib/ledger';
import { TxOriginContext } from '../lib/txOrigin';
import { BulkBar } from './BulkBar';
import { TxDialogsProvider } from './dialogs/TxDialogsProvider';
import { EntryButtons } from './EntryButtons';
import { FilterRail } from './FilterRail';
import { Ledger } from './Ledger';
import { MonthNav } from './MonthBar';
import { TxDrawer } from './TxDrawer';
import styles from './Transactions.module.css';

export interface AccountLedgerProps {
  account: Account;
  /** Adds Import and Add transaction (header and empty state). Transfer is always offered while active. */
  canAdd: boolean;
}

/**
 * The transactions ledger pinned to one account: month navigation, the filter
 * rail without the Account filter, day groups, the `?tx=` drawer and bulk delete.
 * Brings its own dialog host and puts the entry buttons in the page header.
 */
export function AccountLedger(props: AccountLedgerProps) {
  const { id, name } = props.account;
  const origin = useMemo(
    () => [
      { label: 'Accounts', to: '/accounts' },
      { label: name, to: `/accounts/${id}` },
    ],
    [id, name]
  );
  return (
    <TxOriginContext.Provider value={origin}>
      <TxDialogsProvider>
        <AccountLedgerView {...props} />
      </TxDialogsProvider>
    </TxOriginContext.Provider>
  );
}

function AccountLedgerView({ account, canAdd }: AccountLedgerProps) {
  const archived = !!account.archived_at;
  const f = useTransactionFilters({ accountId: account.id, canAdd: canAdd && !archived });
  const query = useTransactionList(f.params);
  const base = useLedgerContext();
  // Archived accounts are not in the picker list; add this one so its rows keep their name and currency.
  const ctx = useMemo(
    () => ({ ...base, accounts: new Map(base.accounts).set(account.id, account) }),
    [base, account]
  );
  const selection = useBulkSelection();
  const drawer = useTxDrawer();
  const rows = query.data?.data;
  const groups = useMemo(() => (rows && ctx.ready ? groupByDay(rows, ctx) : []), [rows, ctx]);
  const complete = !!query.data && query.data.pagination.total <= query.data.data.length;
  const flows = rows && complete ? accountFlows(rows) : null;
  const cur = String(account.currency);
  const fig = (v: number | undefined) =>
    query.isLoading ? (
      <Skeleton width={90} height={18} />
    ) : v === undefined ? (
      '--'
    ) : (
      <Money amount={v} currency={cur} sign={SignDisplay.Always} />
    );

  return (
    <div className={styles.page}>
      {archived ? null : (
        <PageActions>
          <EntryButtons accountId={account.id} transferOnly={!canAdd} />
        </PageActions>
      )}
      <section className={styles.monthbar} aria-label="Month">
        <MonthNav f={f} />
        <div className={styles.monthStats}>
          <StatGroup label={`This account, ${cur}, transfers included`}>
            <Stat label="Money in" value={fig(flows?.in)} />
            <Stat label="Money out" value={fig(flows?.out)} />
            <Stat
              label="Net"
              value={fig(flows?.net)}
              foot={flows ? `${flows.count} txn, filters applied` : 'Too many rows to total'}
            />
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
