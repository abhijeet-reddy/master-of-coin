import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { useId, type CSSProperties } from 'react';
import type { Account, AccountType, InvestmentProvider } from '@/api/types';
import type { BankProvider } from '@/api/types/bankProvider';
import type { RateTable } from '@/lib/fx';
import { SignDisplay } from '@/lib/format';
import { Money } from '@/ui';
import { useAccountDialogs } from '../hooks/accountDialogs';
import { useGridRemainder } from '../hooks/useGridRemainder';
import { convertBalance, providerState, type AccountGroup } from '../lib/accountsModel';
import { AccountCard } from './AccountCard';
import styles from './Accounts.module.css';

export interface CardContext {
  base: string;
  rates: RateTable | null;
  banks: BankProvider[];
  investments: InvestmentProvider[];
}

const plural = (n: number) => `${n} ${n === 1 ? 'account' : 'accounts'}`;

function Cards({
  accounts,
  ctx,
  slot,
}: {
  accounts: Account[];
  ctx: CardContext;
  slot?: { type: AccountType; label: string };
}) {
  const dialogs = useAccountDialogs();
  const grid = useGridRemainder<HTMLDivElement>(accounts.length);
  return (
    <div className={styles.grid} ref={grid.ref}>
      {accounts.map((a) => (
        <AccountCard
          key={a.id}
          account={a}
          provider={providerState(a, ctx.banks, ctx.investments)}
          converted={convertBalance(a, ctx.base, ctx.rates)}
          base={ctx.base}
        />
      ))}
      {slot && grid.remainder > 0 ? (
        <button
          type="button"
          className={styles.slot}
          style={{ gridColumn: `span ${grid.remainder}` } as CSSProperties}
          onClick={() => dialogs.openCreate(slot.type)}
        >
          <Plus aria-hidden />
          Add {slot.label.toLowerCase()}
        </button>
      ) : null}
    </div>
  );
}

/** One type group: heading with count and total, then the cards and an "Add" slot filling the row. */
export function AccountGroupSection({ group, ctx }: { group: AccountGroup; ctx: CardContext }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={styles.group}>
      <div className={styles.groupHead}>
        <h2 id={id}>
          {group.label}
          <small>
            {plural(group.accounts.length)}
            {group.liability ? ', liability' : ''}
          </small>
        </h2>
        <Money
          amount={group.total}
          currency={ctx.base}
          sign={group.liability ? SignDisplay.Auto : SignDisplay.Always}
        />
      </div>
      <Cards
        accounts={group.accounts}
        ctx={ctx}
        slot={{ type: group.type as AccountType, label: group.label }}
      />
    </section>
  );
}

/** Archived accounts, collapsed by default. They still count toward net worth. */
export function ArchivedGroup({
  accounts,
  ctx,
  open,
  onToggle,
}: {
  accounts: Account[];
  ctx: CardContext;
  open: boolean;
  onToggle: (open: boolean) => void;
}) {
  const id = useId();
  const Icon = open ? ChevronDown : ChevronRight;
  return (
    <section aria-labelledby={id} className={styles.group}>
      <div className={styles.groupHead}>
        <h2 id={id}>
          <button
            type="button"
            className={styles.disclosure}
            aria-expanded={open}
            aria-controls={`${id}-body`}
            onClick={() => onToggle(!open)}
          >
            <Icon aria-hidden />
            Archived
          </button>
          <small>{plural(accounts.length)}, still in net worth</small>
        </h2>
      </div>
      {open ? (
        <div id={`${id}-body`}>
          <Cards accounts={accounts} ctx={ctx} />
        </div>
      ) : null}
    </section>
  );
}
