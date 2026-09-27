import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { SignDisplay } from '@/lib/format';
import {
  ButtonVariant,
  ControlSize,
  EmptyState,
  Money,
  MoneySize,
  Panel,
  Skeleton,
  Stat,
  StatGroup,
  buttonClass,
} from '@/ui';
import { debtTotals, type DebtTotals } from '@/lib/debtCurrency';
import { usePeopleWithBalances } from '@/lib/useDebtContext';
import { debtRows, type DebtRow } from '../lib/dashboardModel';
import { PanelState } from '@/ui/PanelState';
import styles from './Dashboard.module.css';

/**
 * Who owes whom: the two totals, then the biggest balances on a diverging bar. Every figure is
 * converted into the default currency per split, never the server's cross-currency raw sum.
 */
export function DebtsPanel() {
  const query = usePeopleWithBalances();
  const rows = query.data ? debtRows(query.data) : [];
  return (
    <Panel
      title="Debts"
      actions={
        <Link to="/people" className={buttonClass(ButtonVariant.Ghost, ControlSize.Sm)}>
          {query.data ? `${query.data.length} people` : 'People'}
        </Link>
      }
      flush
    >
      <PanelState
        query={query}
        skeleton={
          <div className={styles.pad}>
            <Skeleton lines={6} height={14} />
          </div>
        }
      >
        {(people) => (
          <>
            <Totals totals={debtTotals(people.map((p) => p.balance))} />
            {rows.length ? (
              <People rows={rows} />
            ) : (
              <EmptyState compact title="All square" description="Nobody owes anybody right now." />
            )}
          </>
        )}
      </PanelState>
    </Panel>
  );
}

function Totals({ totals }: { totals: DebtTotals }) {
  const foot = totals.missing.length ? `Excludes ${totals.missing.join(', ')}: no rate` : undefined;
  return (
    <StatGroup label="Debt totals">
      <Stat
        label="Owed to you"
        value={<Money amount={totals.owedToMe} sign={SignDisplay.Always} size={MoneySize.Medium} />}
        foot={foot}
      />
      <Stat
        label="You owe"
        value={<Money amount={-totals.iOwe} sign={SignDisplay.Auto} size={MoneySize.Medium} />}
        foot={foot}
      />
    </StatGroup>
  );
}

function People({ rows }: { rows: DebtRow[] }) {
  return (
    <div className={styles.pad}>
      <ul className={styles.rows}>
        {rows.map((r) => (
          <li key={r.id} className={styles.debt}>
            <span className={styles.avatar} aria-hidden>
              {r.name.slice(0, 1).toUpperCase()}
            </span>
            <Link to={`/people/${r.id}`} className={styles.rowName}>
              {r.name} <span className={styles.dim}>{r.net > 0 ? 'owes you' : 'you owe'}</span>
            </Link>
            <Money amount={r.net} sign={r.net > 0 ? SignDisplay.Always : SignDisplay.Auto} />
            <span
              className={r.net > 0 ? styles.divergeRight : styles.divergeLeft}
              style={{ '--w': `${r.width * 50}%` } as CSSProperties}
              aria-hidden
            />
          </li>
        ))}
      </ul>
      <p className={styles.note}>Left: you owe. Right: owed to you.</p>
    </div>
  );
}
