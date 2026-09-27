import { RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePreferences } from '@/lib/preferences';
import { Button, ButtonVariant, ControlSize, EmptyState, Panel, Skeleton, buttonClass } from '@/ui';
import {
  useAccountList,
  useBankProviders,
  useInvestmentProviders,
  useRates,
} from '../hooks/useDashboardQueries';
import { combineQueries } from '@/lib/panelQuery';
import { useSyncProvider } from '../hooks/useSyncProvider';
import { fxPairs, providerLinks, type ProviderLink } from '../lib/dashboardModel';
import type { Account } from '@/api/types';
import { PanelState } from '@/ui/PanelState';
import styles from './Dashboard.module.css';

const NAMES = { bank: 'TrueLayer', investment: 'Trading 212' };

/** Linked bank and brokerage accounts with a sync button each, then the FX rates in use. */
export function ProviderLinksPanel() {
  const query = combineQueries(useBankProviders(), useInvestmentProviders(), useAccountList());
  const links = query.data ? providerLinks(query.data[0], query.data[1], query.data[2], NAMES) : [];
  return (
    <Panel
      title="Provider links"
      actions={query.data ? <span className={styles.meta}>{links.length} linked</span> : null}
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
        {([, , accounts]) => (
          <>
            {links.length ? (
              <ul className={`${styles.links} moc-stagger`}>
                {links.map((l) => (
                  <ProviderRow key={`${l.kind}-${l.id}`} link={l} />
                ))}
              </ul>
            ) : (
              <EmptyState
                compact
                title="No linked providers"
                description="Link a bank or brokerage from an account to sync it here."
                action={
                  <Link
                    to="/accounts"
                    className={buttonClass(ButtonVariant.Secondary, ControlSize.Sm)}
                  >
                    Accounts
                  </Link>
                }
              />
            )}
            <FxRates accounts={accounts} />
          </>
        )}
      </PanelState>
    </Panel>
  );
}

function ProviderRow({ link }: { link: ProviderLink }) {
  const { fmt } = usePreferences();
  const sync = useSyncProvider(link);
  const synced = link.lastSyncAt ? `synced ${fmt.relative(link.lastSyncAt)}` : null;
  return (
    <li className={styles.link}>
      <div className={styles.linkText}>
        <Link to={`/accounts/${link.accountId}`} className={styles.rowName}>
          {link.accountName}
        </Link>
        <span className={styles.linkMeta}>
          <i className={styles.dot} aria-hidden />
          {link.providerName}
          {synced ? `, ${synced}` : ''}
        </span>
      </div>
      <Button
        size={ControlSize.Sm}
        icon={<RefreshCw aria-hidden />}
        loading={sync.isPending}
        onClick={() => sync.mutate()}
        aria-label={`Sync now: ${link.accountName}`}
      >
        Sync now
      </Button>
    </li>
  );
}

function FxRates({ accounts }: { accounts: Account[] }) {
  const { prefs, fmt } = usePreferences();
  const base = prefs.default_currency;
  const pairs = fxPairs(accounts, base, undefined);
  const rates = useRates(base, pairs.length > 0);
  if (pairs.length === 0) return null;
  const live = fxPairs(accounts, base, rates.data?.conversion_rates);
  return (
    <section className={styles.fx} aria-label={`FX rates to ${base}`}>
      <h3 className={styles.kicker}>FX rates to {base}</h3>
      {rates.isError ? (
        <p className={styles.note}>
          Rates unavailable.{' '}
          <button type="button" className={styles.inlineBtn} onClick={() => void rates.refetch()}>
            Retry
          </button>
        </p>
      ) : (
        <dl className={`${styles.kv} moc-stagger`}>
          {live.map((p) => (
            <div key={p.code}>
              <dt>
                {p.code}/{base}
              </dt>
              <dd>
                {rates.isPending ? (
                  <Skeleton width={48} />
                ) : p.rate == null ? (
                  '--'
                ) : (
                  fmt.number(p.rate, { minimumFractionDigits: 4, maximumFractionDigits: 4 })
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
