import { Link2, Plus } from 'lucide-react';
import { PageActions } from '@/app/shell/PageActions';
import { combineQueries } from '@/lib/panelQuery';
import { useUrlState } from '@/lib/urlState';
import {
  Button,
  ButtonVariant,
  EmptyState,
  GridCell,
  Panel,
  PanelGrid,
  PanelState,
  Skeleton,
} from '@/ui';
import { AccountDialogsProvider } from '../components/AccountDialogsProvider';
import { AccountGroupSection, ArchivedGroup, type CardContext } from '../components/AccountGroups';
import { ExposurePanel, TotalPanel } from '../components/OverviewPanels';
import { useAccountDialogs } from '../hooks/accountDialogs';
import {
  useAllAccounts,
  useBankProviders,
  useInvestmentProviders,
  useRateTable,
} from '../hooks/useAccountQueries';
import { accountsOverview } from '../lib/accountsModel';
import { listSchema } from '../lib/listParams';
import styles from '../components/Accounts.module.css';

/** `/accounts`: totals, exposure, one group per type, and a collapsed Archived group. */
export function AccountsPage() {
  return (
    <AccountDialogsProvider>
      <AccountsView />
    </AccountDialogsProvider>
  );
}

function AccountsView() {
  const dialogs = useAccountDialogs();
  const accounts = useAllAccounts();
  const fx = useRateTable(accounts.data);
  const query = combineQueries(accounts, useBankProviders(), useInvestmentProviders());
  const [params, setParams] = useUrlState(listSchema);
  const ratesPending = !fx.ready;

  return (
    <div className={styles.page}>
      <PageActions>
        <Button icon={<Link2 aria-hidden />} onClick={() => dialogs.openConnect()}>
          Connect provider
        </Button>
        <Button
          variant={ButtonVariant.Primary}
          icon={<Plus aria-hidden />}
          onClick={() => dialogs.openCreate()}
        >
          Add account
        </Button>
      </PageActions>
      <PanelState
        query={{
          ...query,
          data: ratesPending ? undefined : query.data,
          isPending: query.isPending || ratesPending,
        }}
        skeleton={<ListSkeleton />}
        empty={([list]) =>
          list.length === 0 ? (
            <Panel>
              <EmptyState
                title="No accounts yet"
                description="Add the places your money lives: bank accounts, cards, cash, a brokerage."
                action={
                  <Button
                    variant={ButtonVariant.Primary}
                    icon={<Plus aria-hidden />}
                    onClick={() => dialogs.openCreate()}
                  >
                    Add account
                  </Button>
                }
              />
            </Panel>
          ) : null
        }
      >
        {([list, banks, investments]) => {
          const o = accountsOverview(list, fx.base, fx.table);
          const ctx: CardContext = { base: fx.base, rates: fx.table, banks, investments };
          return (
            <>
              <PanelGrid>
                <GridCell span={5} spanMd={12}>
                  <TotalPanel o={o} base={fx.base} />
                </GridCell>
                <GridCell span={7} spanMd={12}>
                  <ExposurePanel o={o} base={fx.base} />
                </GridCell>
              </PanelGrid>
              {o.groups.map((g) => (
                <AccountGroupSection key={g.type} group={g} ctx={ctx} />
              ))}
              {o.archived.length ? (
                <ArchivedGroup
                  accounts={o.archived}
                  ctx={ctx}
                  open={params.archived}
                  onToggle={(archived) => setParams({ archived })}
                />
              ) : null}
            </>
          );
        }}
      </PanelState>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className={styles.skeleton}>
      <PanelGrid>
        <GridCell span={5} spanMd={12}>
          <Panel title="Total balance">
            <Skeleton height={72} width="70%" />
            <Skeleton lines={2} />
          </Panel>
        </GridCell>
        <GridCell span={7} spanMd={12}>
          <Panel title="Exposure by type">
            <Skeleton lines={5} height={14} />
          </Panel>
        </GridCell>
      </PanelGrid>
      <div className={`${styles.grid} moc-stagger`}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={styles.card}>
            <Skeleton width="50%" />
            <Skeleton height={32} width="70%" />
            <Skeleton />
          </div>
        ))}
      </div>
    </div>
  );
}
