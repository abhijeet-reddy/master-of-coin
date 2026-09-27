import {
  Archive,
  ArchiveRestore,
  Link2,
  List,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import type { Account } from '@/api/types';
import { typeMeta } from '@/lib/accountTypes';
import { SignDisplay } from '@/lib/format';
import { usePreferences } from '@/lib/preferences';
import {
  Badge,
  Button,
  ButtonVariant,
  ControlSize,
  IconButton,
  Menu,
  MenuItem,
  MenuSeparator,
  Money,
  Tone,
} from '@/ui';
import { useAccountDialogs } from '../hooks/accountDialogs';
import { useAccountSync } from '../hooks/useAccountSync';
import { isArchived, ProviderKind, type Converted, type ProviderState } from '../lib/accountsModel';
import styles from './Accounts.module.css';

export interface AccountCardProps {
  account: Account;
  provider: ProviderState;
  converted: Converted;
  base: string;
}

/** One account: name and tags, balance (with the base-currency equivalent), provider footer, actions menu. */
export function AccountCard({ account, provider, converted, base }: AccountCardProps) {
  const { fmt } = usePreferences();
  const meta = typeMeta(account.account_type);
  const cur = String(account.currency);
  const archived = isArchived(account);
  const headingId = `acc-${account.id}`;
  const sync = useAccountSync(account, provider);
  return (
    <article
      className={`${styles.card} ${meta.liability ? styles.liab : ''} ${archived ? styles.archivedCard : ''}`}
      aria-labelledby={headingId}
    >
      <span className={`${styles.corner} ${styles.c1}`} aria-hidden />
      <span className={`${styles.corner} ${styles.c2}`} aria-hidden />
      <span className={`${styles.corner} ${styles.c3}`} aria-hidden />
      <span className={`${styles.corner} ${styles.c4}`} aria-hidden />
      <div className={styles.cardTop}>
        <div>
          <h3 id={headingId} className={styles.cardName}>
            <Link to={`/accounts/${account.id}`}>{account.name}</Link>
          </h3>
          <div className={styles.tags}>
            <Badge>{meta.tag}</Badge>
            <Badge>{cur}</Badge>
            {meta.liability ? (
              <Badge tone={Tone.Crit} icon={<TriangleAlert aria-hidden />}>
                Liability
              </Badge>
            ) : null}
            {archived ? <Badge tone={Tone.Warn}>Archived</Badge> : null}
          </div>
        </div>
        <CardMenu account={account} provider={provider} sync={sync} />
      </div>
      <div className={styles.bal}>
        <span className={styles.kicker}>{meta.liability ? 'Owed' : 'Balance'}</span>
        <Money
          className={styles.balFig}
          amount={account.balance}
          currency={cur}
          sign={meta.liability ? SignDisplay.Auto : SignDisplay.Always}
        />
        {cur !== base ? (
          <span className={styles.eq}>
            {converted.value === null
              ? `No ${cur} to ${base} rate yet`
              : `approx. ${fmt.money(converted.value, base)} at ${(converted.rate ?? 0).toFixed(4)}`}
          </span>
        ) : null}
      </div>
      <CardFoot account={account} provider={provider} sync={sync} />
    </article>
  );
}

type Sync = ReturnType<typeof useAccountSync>;

function CardFoot({
  account,
  provider,
  sync,
}: {
  account: Account;
  provider: ProviderState;
  sync: Sync;
}) {
  const { fmt } = usePreferences();
  const dialogs = useAccountDialogs();
  const status =
    provider.kind === ProviderKind.None
      ? 'Manual ledger'
      : !provider.linked
        ? `${provider.name}, pick an account`
        : provider.lastSyncAt
          ? `${provider.name}, synced ${fmt.relative(provider.lastSyncAt)}`
          : `${provider.name}, connected`;
  return (
    <div className={styles.foot}>
      <span className={styles.st}>
        <i
          aria-hidden
          className={
            provider.kind === ProviderKind.None
              ? styles.dotOff
              : provider.linked
                ? styles.dotOn
                : styles.dotWarn
          }
        />
        {status}
      </span>
      {sync ? (
        <Button
          size={ControlSize.Sm}
          icon={<RefreshCw aria-hidden />}
          loading={sync.pending}
          onClick={sync.run}
        >
          {sync.label}
        </Button>
      ) : provider.connectable ? (
        <Button
          size={ControlSize.Sm}
          variant={ButtonVariant.Ghost}
          icon={<Link2 aria-hidden />}
          onClick={() => dialogs.openConnect(account)}
          aria-label={`Connect ${account.name}`}
        >
          Connect
        </Button>
      ) : provider.kind === ProviderKind.Bank && !provider.linked ? (
        <Link to={`/accounts/${account.id}`} className={styles.footLink}>
          Finish setup
        </Link>
      ) : null}
    </div>
  );
}

function CardMenu({
  account,
  provider,
  sync,
}: {
  account: Account;
  provider: ProviderState;
  sync: Sync;
}) {
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
        icon={<List aria-hidden />}
        onSelect={() => void navigate(`/accounts/${account.id}`)}
      >
        View transactions
      </MenuItem>
      {sync ? (
        <MenuItem icon={<RefreshCw aria-hidden />} onSelect={sync.run} disabled={sync.pending}>
          {sync.label}
        </MenuItem>
      ) : provider.connectable ? (
        <MenuItem icon={<Link2 aria-hidden />} onSelect={() => dialogs.openConnect(account)}>
          Connect provider
        </MenuItem>
      ) : null}
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
        onSelect={() => dialogs.confirmDelete(account)}
      >
        Delete
      </MenuItem>
    </Menu>
  );
}
