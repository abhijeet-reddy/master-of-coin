import {
  Archive,
  ArchiveRestore,
  Link2,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Trash2,
  TriangleAlert,
  Unplug,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AreaChart } from '@/charts';
import type { Account } from '@/api/types';
import { isInvestmentType, typeMeta } from '@/lib/accountTypes';
import { combineQueries } from '@/lib/panelQuery';
import { DateStyle, SignDisplay, toNumber } from '@/lib/format';
import { usePreferences } from '@/lib/preferences';
import {
  Badge,
  Button,
  ButtonVariant,
  ConfirmDialog,
  ControlSize,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  Menu,
  MenuItem,
  MenuSeparator,
  Money,
  MoneySize,
  Panel,
  PanelState,
  Select,
  Skeleton,
  Stat,
  StatGroup,
  Tone,
} from '@/ui';
import { useAccountDialogs } from '../hooks/accountDialogs';
import { useDisconnect, useLinkBankAccount } from '../hooks/useAccountMutations';
import {
  historyStart,
  HISTORY_DAYS,
  useBankBalance,
  useExternalAccounts,
  useHistoryTransactions,
  useLatestPortfolioSync,
} from '../hooks/useAccountQueries';
import { useAccountSync } from '../hooks/useAccountSync';
import {
  balanceHistory,
  bankDrift,
  isArchived,
  portfolioDrift,
  ProviderKind,
  type Converted,
  type Drift,
  type ProviderState,
} from '../lib/accountsModel';
import { Notice } from './Notice';
import { NoticeKind } from './noticeKind';
import styles from './Accounts.module.css';

/** Balance, tags, notes and the account's own actions. */
export function SummaryPanel({
  account,
  converted,
  base,
}: {
  account: Account;
  converted: Converted;
  base: string;
}) {
  const { fmt } = usePreferences();
  const dialogs = useAccountDialogs();
  const meta = typeMeta(account.account_type);
  const archived = isArchived(account);
  const cur = String(account.currency);
  return (
    <Panel title="Account" actions={<SummaryMenu account={account} />} flush>
      <div className={styles.pad}>
        <div className={styles.hero}>
          <div className={styles.tags}>
            <Badge>{meta.label}</Badge>
            <Badge>{cur}</Badge>
            {meta.liability ? (
              <Badge tone={Tone.Crit} icon={<TriangleAlert aria-hidden />}>
                Liability
              </Badge>
            ) : null}
            {archived ? <Badge tone={Tone.Warn}>Archived</Badge> : null}
          </div>
          <span className={styles.kicker}>{meta.liability ? 'Owed' : 'Balance'}</span>
          <Money amount={account.balance} currency={cur} size={MoneySize.Large} />
          {cur !== base && converted.value !== null ? (
            <span className={styles.eq}>
              approx. {fmt.money(converted.value, base)} at {(converted.rate ?? 0).toFixed(4)}
            </span>
          ) : null}
        </div>
      </div>
      {archived ? (
        <div className={styles.pad}>
          <Notice kind={NoticeKind.Warn}>
            Archived {account.archived_at ? fmt.date(account.archived_at, DateStyle.Medium) : ''}.
            It is hidden from pickers and cannot sync, but still counts toward net worth.
          </Notice>
          <div className={styles.actionsRow}>
            <Button
              icon={<ArchiveRestore aria-hidden />}
              onClick={() => dialogs.confirmArchive(account)}
            >
              Unarchive
            </Button>
          </div>
        </div>
      ) : isInvestmentType(account.account_type) ? (
        <div className={styles.pad}>
          <Button icon={<Wallet aria-hidden />} onClick={() => dialogs.openBalance(account)}>
            Update value
          </Button>
        </div>
      ) : null}
      {account.notes ? (
        <div className={styles.notes}>
          <span className={styles.kicker}>Notes</span>
          <p>{account.notes}</p>
        </div>
      ) : null}
    </Panel>
  );
}

function SummaryMenu({ account }: { account: Account }) {
  const dialogs = useAccountDialogs();
  const navigate = useNavigate();
  const archived = isArchived(account);
  return (
    <Menu
      label={`Actions for ${account.name}`}
      trigger={
        <IconButton
          label={`Actions for ${account.name}`}
          icon={<MoreHorizontal />}
          size={ControlSize.Sm}
        />
      }
    >
      <MenuItem icon={<Pencil aria-hidden />} onSelect={() => dialogs.openEdit(account)}>
        Edit
      </MenuItem>
      <MenuItem
        icon={archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
        onSelect={() => dialogs.confirmArchive(account)}
      >
        {archived ? 'Unarchive' : 'Archive'}
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        icon={<Trash2 aria-hidden />}
        danger
        onSelect={() =>
          dialogs.confirmDelete(account, () => void navigate('/accounts', { replace: true }))
        }
      >
        Delete
      </MenuItem>
    </Menu>
  );
}

/** End-of-day balance over the last 90 days, rebuilt from the account's transactions. */
export function HistoryPanel({ account }: { account: Account }) {
  const { fmt } = usePreferences();
  const txs = useHistoryTransactions(account.id);
  const cur = String(account.currency);
  return (
    <Panel
      title="Balance history"
      actions={<span className={styles.meta}>{`${cur}, ${HISTORY_DAYS} days`}</span>}
    >
      <PanelState
        query={txs}
        skeleton={<Skeleton height={220} />}
        empty={(page) =>
          page.data.length === 0 ? (
            <EmptyState
              compact
              title="No movement in 90 days"
              description={`The balance has been ${fmt.money(toNumber(account.balance), cur)} throughout.`}
            />
          ) : null
        }
      >
        {(page) => {
          const h = balanceHistory(
            account.balance,
            page.data,
            historyStart(),
            new Date(),
            page.pagination.has_more
          );
          return (
            <div className={styles.stack}>
              <p className={h.change >= 0 ? styles.deltaUp : styles.deltaDown}>
                <span>{h.change >= 0 ? 'Up' : 'Down'}</span>
                <Money amount={Math.abs(h.change)} currency={cur} sign={SignDisplay.Never} />
                <span className={styles.since}>
                  since {fmt.date(h.points[0]?.day, DateStyle.DayMonth)}
                </span>
              </p>
              <AreaChart
                title="Balance"
                height={220}
                includeZero={false}
                format={(n) => fmt.money(n, cur)}
                axisFormat={(n) => fmt.money(n, cur, { compact: true })}
                data={h.points.map((p) => ({
                  label: fmt.date(p.day, DateStyle.DayMonth),
                  value: p.balance,
                }))}
              />
              {!h.complete ? (
                <p className={styles.note}>
                  Too many transactions to load; the line starts at the oldest one shown.
                </p>
              ) : null}
            </div>
          );
        }}
      </PanelState>
    </Panel>
  );
}

/** What feeds the account, and its sync action. */
export function ProviderPanel({
  account,
  provider,
}: {
  account: Account;
  provider: ProviderState;
}) {
  const { fmt } = usePreferences();
  const dialogs = useAccountDialogs();
  const sync = useAccountSync(account, provider);
  const [confirm, setConfirm] = useState(false);
  const disconnect = useDisconnect(account);
  const archived = isArchived(account);

  if (provider.kind === ProviderKind.None) {
    return (
      <Panel title="Provider">
        <EmptyState
          compact
          title="Manual ledger"
          description={
            provider.connectable
              ? 'Connect a provider to sync the balance and transactions.'
              : archived
                ? 'Unarchive the account to connect a provider.'
                : `${typeMeta(account.account_type).label} accounts are kept by hand.`
          }
          action={
            provider.connectable ? (
              <Button icon={<Link2 aria-hidden />} onClick={() => dialogs.openConnect(account)}>
                Connect provider
              </Button>
            ) : undefined
          }
        />
      </Panel>
    );
  }
  return (
    <Panel title="Provider" actions={<span className={styles.meta}>{provider.name}</span>}>
      <div className={styles.stack}>
        <StatGroup label="Provider">
          <Stat label="Status" value={provider.linked ? 'Connected' : 'Pick an account'} />
          <Stat
            label="Last sync"
            value={provider.lastSyncAt ? fmt.relative(provider.lastSyncAt) : 'Not yet'}
          />
        </StatGroup>
        {provider.kind === ProviderKind.Bank && !provider.linked ? (
          <LinkBankAccount providerId={provider.id} />
        ) : null}
        {archived ? <Notice kind={NoticeKind.Info}>Archived accounts cannot sync.</Notice> : null}
        <div className={styles.actionsRow}>
          {sync ? (
            <Button
              variant={ButtonVariant.Primary}
              icon={<RefreshCw aria-hidden />}
              loading={sync.pending}
              onClick={sync.run}
            >
              {sync.label}
            </Button>
          ) : null}
          <Button
            variant={ButtonVariant.Ghost}
            icon={<Unplug aria-hidden />}
            onClick={() => setConfirm(true)}
          >
            Disconnect
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Disconnect ${provider.name}?`}
        confirmLabel="Disconnect"
        onConfirm={() => disconnect.mutateAsync(provider.id ?? '')}
      >
        <p className={styles.confirmText}>
          {account.name} stops syncing. Its transactions stay; you can connect again later.
        </p>
      </ConfirmDialog>
    </Panel>
  );
}

/** After TrueLayer: choose which of the bank's accounts feeds this one. */
function LinkBankAccount({ providerId }: { providerId: string | null }) {
  const external = useExternalAccounts(providerId, true);
  const link = useLinkBankAccount(providerId);
  const [picked, setPicked] = useState<string | undefined>(undefined);
  return (
    <PanelState
      query={external}
      skeleton={<Skeleton height={36} />}
      empty={(list) =>
        list.length === 0 ? (
          <EmptyState
            compact
            title="The bank returned no accounts"
            description="Disconnect and connect again."
          />
        ) : null
      }
    >
      {(list) => (
        <div className={styles.linkRow}>
          <Field label="Bank account" required>
            <Select
              value={picked}
              onValueChange={setPicked}
              placeholder="Pick the bank account"
              options={list.map((x) => ({
                value: x.account_id,
                label: `${x.account_name} (${x.currency}${x.account_number ? `, ${x.account_number.slice(-4)}` : ''})`,
              }))}
            />
          </Field>
          <Button
            disabled={!picked}
            loading={link.isPending}
            onClick={() => picked && link.mutate(picked)}
          >
            Link
          </Button>
        </div>
      )}
    </PanelState>
  );
}

/** Ledger against the provider: the bank's live balance, or the last portfolio sync. */
export function DriftPanel({ account, provider }: { account: Account; provider: ProviderState }) {
  const bank = useBankBalance(
    provider.kind === ProviderKind.Bank && provider.linked ? provider.id : null
  );
  const portfolio = useLatestPortfolioSync(account.id, provider.kind === ProviderKind.Investment);
  const cur = String(account.currency);

  if (provider.kind === ProviderKind.Bank && provider.linked) {
    return (
      <Panel title="Drift" actions={<span className={styles.meta}>Ledger vs bank</span>}>
        <PanelState query={combineQueries(bank)} skeleton={<Skeleton lines={3} />}>
          {([b]) => (
            <DriftBody
              drift={bankDrift(account.balance, b)}
              currency={cur}
              externalLabel="Bank says"
            />
          )}
        </PanelState>
      </Panel>
    );
  }
  if (provider.kind === ProviderKind.Investment) {
    return (
      <Panel title="Drift" actions={<span className={styles.meta}>Last portfolio sync</span>}>
        <PanelState
          query={portfolio}
          skeleton={<Skeleton lines={3} />}
          empty={(job) =>
            !job ? (
              <EmptyState
                compact
                title="No sync yet"
                description="Sync the portfolio to compare against Trading 212."
              />
            ) : null
          }
        >
          {(job) => {
            const d = job ? portfolioDrift(job.result, account.id) : null;
            if (!d) return null;
            return (
              <>
                <DriftBody
                  drift={d}
                  currency={cur}
                  externalLabel="Broker value"
                  ledgerLabel="Ledger before"
                  booked={!d.error}
                />
                {d.error ? <Notice>{d.error}</Notice> : null}
                <p className={styles.note}>
                  {d.inSync
                    ? 'No adjustment was needed.'
                    : 'The difference was booked as an adjustment.'}{' '}
                  <Link to={`/jobs/portfolio-sync/${job?.job_id ?? ''}`}>View sync</Link>
                </p>
              </>
            );
          }}
        </PanelState>
      </Panel>
    );
  }
  return (
    <Panel title="Drift">
      <EmptyState
        compact
        title="Nothing to compare"
        description="Drift compares the ledger with a connected bank or brokerage. This account has neither linked."
      />
    </Panel>
  );
}

function DriftBody({
  drift,
  currency,
  externalLabel,
  ledgerLabel = 'Ledger',
  booked = false,
}: {
  drift: Drift;
  currency: string;
  externalLabel: string;
  ledgerLabel?: string;
  /** The sync already booked the difference, so it is history, not a live mismatch. */
  booked?: boolean;
}) {
  return (
    <div className={styles.stack}>
      <StatGroup label="Drift">
        <Stat
          label={ledgerLabel}
          value={<Money amount={drift.ledger} currency={currency} size={MoneySize.Medium} />}
        />
        <Stat
          label={externalLabel}
          value={<Money amount={drift.external} currency={currency} size={MoneySize.Medium} />}
        />
        <Stat
          label="Difference"
          value={
            <Money
              amount={drift.difference}
              currency={currency}
              sign={SignDisplay.Always}
              size={MoneySize.Medium}
            />
          }
        />
      </StatGroup>
      {drift.inSync || booked ? (
        <Badge tone={Tone.Pos}>In sync</Badge>
      ) : (
        <Notice kind={NoticeKind.Warn}>
          The ledger and the provider disagree. Sync, or look for a missing transaction.
        </Notice>
      )}
    </div>
  );
}

export function DetailError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <Panel>
      <ErrorState error={error} title="Couldn't load this account" onRetry={onRetry} />
      <div className={styles.pad}>
        <Link to="/accounts">Back to accounts</Link>
      </div>
    </Panel>
  );
}
