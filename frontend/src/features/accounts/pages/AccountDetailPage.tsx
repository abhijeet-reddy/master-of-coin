import { useParams } from 'react-router-dom';
import { useSetPageMeta } from '@/app/shell/routeMeta';
import { isInvestmentType } from '@/lib/accountTypes';
import { AccountLedger } from '@/features/transactions';
import { ErrorState, GridCell, Panel, PanelGrid, Skeleton } from '@/ui';
import { AccountDialogsProvider } from '../components/AccountDialogsProvider';
import {
  DetailError,
  DriftPanel,
  HistoryPanel,
  ProviderPanel,
  SummaryPanel,
} from '../components/DetailPanels';
import {
  useAccount,
  useBankProviders,
  useInvestmentProviders,
  useRateTable,
} from '../hooks/useAccountQueries';
import { convertBalance, providerState } from '../lib/accountsModel';
import styles from '../components/Accounts.module.css';

/** `/accounts/:id`: summary, balance history, provider and drift, then the account's ledger. */
export function AccountDetailPage() {
  return (
    <AccountDialogsProvider>
      <AccountDetailView />
    </AccountDialogsProvider>
  );
}

function AccountDetailView() {
  const { id = '' } = useParams();
  const account = useAccount(id);
  const banks = useBankProviders();
  const investments = useInvestmentProviders();
  const a = account.data;
  const fx = useRateTable(a ? [a] : undefined);
  useSetPageMeta(a?.name, [{ label: 'Accounts', to: '/accounts' }]);

  if (account.error)
    return <DetailError error={account.error} onRetry={() => void account.refetch()} />;
  if (!a) return <DetailSkeleton />;
  const provider = providerState(a, banks.data ?? [], investments.data ?? []);
  const providersReady = !!banks.data && !!investments.data;
  const retryProviders = () => {
    void banks.refetch();
    void investments.refetch();
  };

  return (
    <div className={styles.page}>
      <PanelGrid>
        <GridCell span={4} spanMd={12}>
          <SummaryPanel
            account={a}
            converted={convertBalance(a, fx.base, fx.table)}
            base={fx.base}
          />
        </GridCell>
        <GridCell span={8} spanMd={12}>
          <HistoryPanel account={a} />
        </GridCell>
        <GridCell span={6} spanMd={12}>
          {providersReady ? (
            <ProviderPanel account={a} provider={provider} />
          ) : (
            <ProvidersPending
              title="Provider"
              error={banks.error ?? investments.error}
              retry={retryProviders}
            />
          )}
        </GridCell>
        <GridCell span={6} spanMd={12}>
          {providersReady ? (
            <DriftPanel account={a} provider={provider} />
          ) : (
            <ProvidersPending
              title="Drift"
              error={banks.error ?? investments.error}
              retry={retryProviders}
            />
          )}
        </GridCell>
      </PanelGrid>
      <section aria-label="Transactions" className={styles.ledger}>
        <AccountLedger account={a} canAdd={!isInvestmentType(a.account_type)} />
      </section>
    </div>
  );
}

function ProvidersPending({
  title,
  error,
  retry,
}: {
  title: string;
  error: unknown;
  retry: () => void;
}) {
  return (
    <Panel title={title}>
      {error ? <ErrorState compact error={error} onRetry={retry} /> : <Skeleton lines={3} />}
    </Panel>
  );
}

function DetailSkeleton() {
  return (
    <div className={styles.page} aria-busy="true">
      <span className="sr-only">Loading</span>
      <PanelGrid>
        <GridCell span={4} spanMd={12}>
          <Panel title="Account">
            <Skeleton height={40} width="60%" />
            <Skeleton lines={2} />
          </Panel>
        </GridCell>
        <GridCell span={8} spanMd={12}>
          <Panel title="Balance history">
            <Skeleton height={220} />
          </Panel>
        </GridCell>
      </PanelGrid>
    </div>
  );
}
