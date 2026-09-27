import { Link2, Unlink } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Person } from '@/api/types';
import { AreaChart } from '@/charts';
import { DateStyle } from '@/lib/format';
import { convert } from '@/lib/fx';
import type { PanelQuery } from '@/lib/panelQuery';
import { usePreferences } from '@/lib/preferences';
import {
  Button,
  ConfirmDialog,
  ControlSize,
  EmptyState,
  Money,
  Panel,
  PanelState,
  SignDisplay,
  Skeleton,
  Stat,
  StatGroup,
} from '@/ui';
import { usePeopleDialogs } from '../hooks/peopleDialogs';
import { useUnlinkSplit } from '../hooks/usePeopleMutations';
import { usePersonHistory, useSplitConfig, useSplitProviders } from '../hooks/usePeopleQueries';
import type { DebtContext } from '@/lib/useDebtContext';
import type { PersonWithBalance } from '@/lib/debtCurrency';
import {
  DEBT_LABEL,
  DebtDirection,
  debtHistory,
  initials,
  personNet,
  type DebtHistory,
} from '../lib/peopleModel';
import { providerLabel } from '../lib/splitLink';
import { DebtBadge } from './DebtBadge';
import { NativeAmounts } from './NativeAmounts';
import styles from './People.module.css';

const RECENT = 8;

/** Who they are and where the balance stands. */
export function BalancePanel({ person: p }: { person: PersonWithBalance }) {
  const { prefs } = usePreferences();
  const cur = prefs.default_currency;
  const d = personNet(p);
  const s = p.debt_summary;
  return (
    <Panel title="Balance">
      <div className={styles.identity}>
        <span className={`${styles.avatar} ${styles.avatarLg}`} aria-hidden>
          {initials(p.name)}
        </span>
        <div>
          <h2>{p.name}</h2>
          <DebtBadge person={p} />
        </div>
      </div>
      <div className={styles.headline}>
        <span className={styles.micro}>{DEBT_LABEL[d.direction]}</span>
        <strong
          className={
            d.direction === DebtDirection.OwesMe
              ? styles.owesMe
              : d.direction === DebtDirection.IOwe
                ? styles.iOwe
                : styles.settled
          }
        >
          <Money amount={d.amount} currency={cur} />
        </strong>
        <NativeAmounts balance={p.balance} />
      </div>
      <dl className={`${styles.facts} moc-stagger`}>
        {p.balance?.foreign ? (
          <div>
            <dt>By currency</dt>
            <dd>
              {p.balance.natives.map((n) => (
                <span key={n.currency} className={styles.nativeLine}>
                  <Money amount={n.amount} currency={n.currency} sign={SignDisplay.Always} />
                </span>
              ))}
            </dd>
          </div>
        ) : (
          <>
            <div>
              <dt>They owe you</dt>
              <dd>
                <Money amount={s?.owes_me ?? 0} currency={cur} />
              </dd>
            </div>
            <div>
              <dt>You owe them</dt>
              <dd>
                <Money amount={s?.i_owe ?? 0} currency={cur} />
              </dd>
            </div>
          </>
        )}
        <div>
          <dt>Shared transactions</dt>
          <dd>{p.transaction_count}</dd>
        </div>
        <Fact label="Email" value={p.email} />
        <Fact label="Phone" value={p.phone} />
      </dl>
      {p.notes ? <p className={styles.note}>{p.notes}</p> : null}
    </Panel>
  );
}

/** A profile field; empty ones read "Not set", muted. */
function Fact({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value?.trim() ? value : <span className={styles.notSet}>Not set</span>}</dd>
    </div>
  );
}

/** Whether splits with this person sync to Splitwise or SplitPro. */
export function SplitLinkPanel({ person }: { person: Person }) {
  const dialogs = usePeopleDialogs();
  const config = useSplitConfig(person.id);
  const providers = useSplitProviders();
  const unlink = useUnlinkSplit(person);
  const [confirm, setConfirm] = useState(false);
  const provider = config.data
    ? providers.data?.find((pr) => pr.id === config.data!.split_provider_id)
    : undefined;

  return (
    <Panel title="Split provider">
      <PanelState query={config} skeleton={<Skeleton lines={2} />}>
        {(c) =>
          c ? (
            <div className={styles.link}>
              <dl className={`${styles.facts} moc-stagger`}>
                <div>
                  <dt>Provider</dt>
                  <dd>{providerLabel(c.provider_type)}</dd>
                </div>
                <div>
                  <dt>Friend id</dt>
                  <dd>{c.external_user_id}</dd>
                </div>
                {provider && !provider.is_active ? (
                  <div>
                    <dt>Status</dt>
                    <dd>Provider inactive</dd>
                  </div>
                ) : null}
              </dl>
              <div className={styles.linkActions}>
                <Button
                  size={ControlSize.Sm}
                  icon={<Link2 aria-hidden />}
                  onClick={() => dialogs.openLink(person)}
                >
                  Change
                </Button>
                <Button
                  size={ControlSize.Sm}
                  icon={<Unlink aria-hidden />}
                  onClick={() => setConfirm(true)}
                >
                  Unlink
                </Button>
              </div>
              <ConfirmDialog
                open={confirm}
                onOpenChange={setConfirm}
                title={`Unlink ${person.name}?`}
                confirmLabel="Unlink"
                onConfirm={() => unlink.mutateAsync()}
              >
                <p className={styles.confirmText}>
                  New splits with {person.name} stop syncing to {providerLabel(c.provider_type)}.
                  Nothing already synced is removed.
                </p>
              </ConfirmDialog>
            </div>
          ) : (
            <EmptyState
              compact
              title="Not linked"
              description="Link a Splitwise or SplitPro friend to sync splits."
              action={
                <Button
                  size={ControlSize.Sm}
                  icon={<Link2 aria-hidden />}
                  onClick={() => dialogs.openLink(person)}
                >
                  Link split provider
                </Button>
              }
            />
          )
        }
      </PanelState>
    </Panel>
  );
}

/** The running balance, rebuilt from the shared transactions, and the latest changes. */
export function DebtHistoryPanel({
  person,
  ctx,
}: {
  person: PersonWithBalance;
  ctx?: DebtContext;
}) {
  const { prefs, fmt } = usePreferences();
  const cur = prefs.default_currency;
  const { query: q, truncated } = usePersonHistory(person.id);
  const net = personNet(person).net;
  const model = useMemo(() => {
    if (!q.data) return undefined;
    // Each change is converted from its account's currency so the line ends at the converted net.
    const toBase = (tx: { account_id: string }, change: number) => {
      const from = ctx?.currencyOf(tx.account_id);
      if (!ctx || !from || from === ctx.base) return change;
      return convert(change, from, ctx.base, ctx.rates) ?? 0;
    };
    return debtHistory(q.data.data, person.id, net, toBase);
  }, [q.data, person.id, net, ctx]);
  const query: PanelQuery<DebtHistory> = {
    data: model,
    isPending: q.isPending,
    error: q.error,
    refetch: () => void q.refetch(),
  };
  const origin = [
    { label: 'People', to: '/people' },
    { label: person.name, to: `/people/${person.id}` },
  ];

  return (
    <Panel title="Debt history">
      <PanelState
        query={query}
        skeleton={<Skeleton height={260} />}
        empty={(h) =>
          h.changes.length === 0 ? (
            <EmptyState
              compact
              title="No shared transactions yet"
              description="Split a transaction with them to start a balance."
            />
          ) : null
        }
      >
        {(h) => (
          <div className={styles.stack}>
            <StatGroup label="History summary">
              <Stat
                label="Now"
                value={<Money amount={net} currency={cur} sign={SignDisplay.Always} />}
              />
              <Stat
                label={truncated ? 'At oldest loaded' : 'Started at'}
                value={<Money amount={h.opening} currency={cur} sign={SignDisplay.Always} />}
              />
              <Stat label="Changes" value={h.changes.length} />
            </StatGroup>
            {h.points.length > 1 ? (
              <AreaChart
                title={`Balance with ${person.name}`}
                height={200}
                format={(n) => fmt.money(n, cur)}
                axisFormat={(n) => fmt.money(n, cur, { compact: true })}
                data={h.points.map((p) => ({
                  label: fmt.date(p.day, DateStyle.DayMonth),
                  value: p.balance,
                }))}
              />
            ) : null}
            <p className={styles.note}>
              Above zero, {person.name} owes you; below zero, you owe them.
            </p>
            {truncated ? (
              <p className={styles.note}>
                Too many transactions to load; the line starts at the oldest one shown.
              </p>
            ) : null}
            <div>
              <h3 className={styles.kicker}>Latest changes</h3>
              <ul className={`${styles.changes} moc-stagger`}>
                {h.changes.slice(0, RECENT).map((c) => (
                  <li key={c.tx.id}>
                    <span className={styles.dim}>{fmt.date(c.day, DateStyle.DayMonth)}</span>
                    <Link to={`/transactions/${c.tx.id}`} state={{ origin }}>
                      {c.tx.title}
                    </Link>
                    <span className={c.change > 0 ? styles.owesMe : styles.iOwe}>
                      <Money amount={c.change} currency={cur} sign={SignDisplay.Always} />
                    </span>
                    <span className={styles.after}>
                      <Money amount={c.balance} currency={cur} sign={SignDisplay.Always} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </PanelState>
    </Panel>
  );
}
