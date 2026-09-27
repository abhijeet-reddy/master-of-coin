import { ArrowDownLeft, ArrowUpRight, RotateCcw } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Transaction } from '@/api/types';
import { DateStyle } from '@/lib/format';
import { rateBetween } from '@/lib/fx';
import { usePreferences } from '@/lib/preferences';
import { Badge, Button, ControlSize, cx, Money, MoneySize, SignDisplay, Tone } from '@/ui';
import { useRestore } from '../hooks/useTxMutations';
import {
  ledgerRow,
  round2,
  splitPersonName,
  transferDelta,
  userShare,
  type LedgerContext,
} from '../lib/ledger';
import { SplitSyncBadge } from './SplitSyncBadge';
import { TxBadges } from './TxBadges';
import { TxTile } from './TxTile';
import styles from './Transactions.module.css';

const TAPE = [
  'var(--viz-cat-2)',
  'var(--viz-cat-3)',
  'var(--viz-cat-4)',
  'var(--viz-cat-5)',
  'var(--viz-cat-6)',
  'var(--viz-cat-7)',
];
const sw = (c: string) => ({ '--c': c }) as CSSProperties;

/** The transaction's full picture; shared by the drawer and `/transactions/:id`. */
export function TxDetail({ tx, ctx }: { tx: Transaction; ctx: LedgerContext }) {
  const { fmt } = usePreferences();
  const restore = useRestore();
  const row = ledgerRow(tx, ctx);
  const account = ctx.accounts.get(tx.account_id);
  const out = row.amount < 0;
  const rate = row.currency !== ctx.base ? rateBetween(row.currency, ctx.base, ctx.rates) : null;
  const splits = tx.splits ?? [];
  const mine = splits.length
    ? userShare(
        row.amount,
        splits.map((s) => s.amount)
      )
    : 0;
  const delta = tx.transfer_info ? transferDelta(tx.amount, tx.transfer_info.linked_amount) : null;
  const participants = tx.debt_metadata?.expense_participants ?? [];

  return (
    <article className={`${styles.dd} moc-stagger`} aria-label={tx.title}>
      {tx.deleted_at ? (
        <div className={styles.banner} role="status">
          <span>
            In Trash since {fmt.date(tx.deleted_at, DateStyle.Medium)}
            {tx.permanent_delete_at
              ? `. Deleted for good on ${fmt.date(tx.permanent_delete_at, DateStyle.Medium)}.`
              : '.'}
          </span>
          <Button
            size={ControlSize.Sm}
            icon={<RotateCcw aria-hidden />}
            onClick={() => void restore([tx.id])}
          >
            Restore
          </Button>
        </div>
      ) : null}

      <header className={styles.ddHead}>
        <TxTile row={row} large />
        <div>
          <h3>{tx.title || 'Untitled'}</h3>
          <span className={styles.eq}>
            <time dateTime={tx.date}>
              {fmt.date(tx.date, DateStyle.Medium)}, {fmt.date(tx.date, DateStyle.Time)}
            </time>
          </span>
        </div>
      </header>

      <div className={styles.ddAmt}>
        <p className={styles.kicker}>
          {out ? <ArrowUpRight aria-hidden /> : <ArrowDownLeft aria-hidden />}
          {row.transfer ? (out ? 'Transfer out' : 'Transfer in') : out ? 'Money out' : 'Money in'}
        </p>
        <div className={styles.ddFig}>
          <Money
            amount={row.amount}
            currency={row.currency}
            sign={SignDisplay.Always}
            size={MoneySize.Large}
          />
        </div>
        {row.converted != null ? (
          <span className={styles.eq}>
            approx. {fmt.money(row.converted, ctx.base, { sign: SignDisplay.Always })}
            {rate ? ` at ${rate.toFixed(4)}` : ''}
          </span>
        ) : row.currency !== ctx.base ? (
          <span className={styles.eq}>
            No {row.currency} to {ctx.base} rate available
          </span>
        ) : null}
      </div>

      <div className={styles.ddBadges}>
        <TxBadges row={row} base={ctx.base} />
      </div>

      <dl className={styles.kv}>
        <dt>Category</dt>
        <dd>{row.transfer ? 'Transfer' : (row.category?.name ?? 'Uncategorised')}</dd>
        <dt>Account</dt>
        <dd>
          {tx.debt_metadata ? (
            'None, paid by someone else'
          ) : account ? (
            <Link to={`/accounts/${account.id}`}>{account.name}</Link>
          ) : (
            'Unknown account'
          )}
          <Badge>{row.currency}</Badge>
        </dd>
        {tx.transfer_info ? (
          <>
            <dt>{out ? 'Sent to' : 'Received from'}</dt>
            <dd>
              <Link to={`/accounts/${tx.transfer_info.linked_account_id}`}>
                {tx.transfer_info.linked_account_name}
              </Link>
            </dd>
            {delta != null ? (
              <>
                <dt>Other leg</dt>
                <dd>
                  <Money amount={tx.transfer_info.linked_amount} sign={SignDisplay.Always} />
                  <Badge tone={Tone.Warn}>{delta > 0 ? 'Less arrived' : 'More arrived'}</Badge>
                </dd>
              </>
            ) : null}
          </>
        ) : null}
        {tx.debt_metadata ? (
          <>
            <dt>Paid by</dt>
            <dd>{tx.debt_metadata.payer_person_name}</dd>
            <dt>Total cost</dt>
            <dd>
              <Money
                amount={tx.debt_metadata.total_cost}
                currency={row.currency}
                sign={SignDisplay.Never}
              />
            </dd>
          </>
        ) : null}
      </dl>

      {splits.length ? (
        <section className={styles.sec} aria-labelledby={`split-${tx.id}`}>
          <div className={styles.secHead}>
            <h4 id={`split-${tx.id}`} className={styles.phTitle}>
              Split
            </h4>
            <span className={styles.micro}>{splits.length + 1} people</span>
          </div>
          <div className={styles.tape} aria-hidden>
            <span style={{ ...sw('var(--accent)'), flex: mine }} />
            {splits.map((s, i) => (
              <span
                key={s.id}
                style={{ ...sw(TAPE[i % TAPE.length]), flex: Math.abs(Number(s.amount)) }}
              />
            ))}
          </div>
          <dl className={styles.kv}>
            <dt>
              <span className={styles.sw} style={sw('var(--accent)')} aria-hidden />
              You
            </dt>
            <dd>
              <Money amount={mine} currency={row.currency} sign={SignDisplay.Never} />
            </dd>
            {splits.map((s, i) => (
              <SplitLine
                key={s.id}
                label={`${splitPersonName(s, ctx.people)} owes you`}
                color={TAPE[i % TAPE.length]}
              >
                <Money
                  amount={Math.abs(Number(s.amount))}
                  currency={row.currency}
                  sign={SignDisplay.Never}
                />
                <SplitSyncBadge splitId={s.id} />
              </SplitLine>
            ))}
            <dt className={styles.tot}>Total</dt>
            <dd className={styles.tot}>
              <Money
                amount={round2(Math.abs(row.amount))}
                currency={row.currency}
                sign={SignDisplay.Never}
              />
            </dd>
          </dl>
        </section>
      ) : null}

      {participants.length ? (
        <section className={styles.sec} aria-labelledby={`part-${tx.id}`}>
          <div className={styles.secHead}>
            <h4 id={`part-${tx.id}`} className={styles.phTitle}>
              Expense breakdown
            </h4>
          </div>
          <dl className={styles.kv}>
            {participants.map((p, i) => (
              <SplitLine
                key={`${p.name}-${i}`}
                label={`${p.name} share`}
                color={TAPE[i % TAPE.length]}
              >
                {Number(p.paid_share) > 0 ? <Badge tone={Tone.Pos}>Paid</Badge> : null}
                <Money amount={p.owed_share} currency={row.currency} sign={SignDisplay.Never} />
              </SplitLine>
            ))}
          </dl>
        </section>
      ) : null}

      <section className={styles.sec} aria-labelledby={`notes-${tx.id}`}>
        <h4 id={`notes-${tx.id}`} className={styles.phTitle}>
          Notes
        </h4>
        <p className={cx(styles.note, !tx.notes?.trim() && styles.noteDim)}>
          {tx.notes?.trim() || 'No notes'}
        </p>
      </section>
    </article>
  );
}

function SplitLine({
  label,
  color,
  children,
}: {
  label: string;
  color: string;
  children: ReactNode;
}) {
  return (
    <>
      <dt>
        <span className={styles.sw} style={sw(color)} aria-hidden />
        {label}
      </dt>
      <dd>{children}</dd>
    </>
  );
}
