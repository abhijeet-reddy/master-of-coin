import { useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useSetPageMeta } from '@/app/shell/routeMeta';
import { ErrorState, Skeleton } from '@/ui';
import { TxDialogsProvider } from '../components/dialogs/TxDialogsProvider';
import { TxDetail } from '../components/TxDetail';
import { TxDetailActions } from '../components/TxDetailActions';
import { useLedgerContext, useTransaction } from '../hooks/useTxQueries';
import { originHome, readOrigin } from '../lib/txOrigin';
import styles from '../components/Transactions.module.css';

/** `/transactions/:id`: the drawer's content as a page, for links and sharing. */
export function TransactionDetailPage() {
  return (
    <TxDialogsProvider>
      <DetailView />
    </TxDialogsProvider>
  );
}

function DetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const query = useTransaction(id);
  const ctx = useLedgerContext();
  const tx = query.data;
  const state: unknown = useLocation().state;
  // Opened from an account or budget ledger: crumb back there, not to Transactions.
  const origin = useMemo(() => readOrigin(state), [state]);
  useSetPageMeta(tx?.title || undefined, origin);

  return (
    <div className={styles.detailPage}>
      <div className={styles.detailPanel}>
        {query.isLoading || (tx && !ctx.ready) ? (
          <>
            <Skeleton width="60%" height={24} />
            <Skeleton height={90} />
            <Skeleton lines={6} />
          </>
        ) : query.isError ? (
          <ErrorState
            error={query.error}
            title="Could not load this transaction"
            onRetry={() => void query.refetch()}
          />
        ) : tx ? (
          <>
            <TxDetail tx={tx} ctx={ctx} />
            <TxDetailActions
              tx={tx}
              onDeleted={() => void navigate(originHome(origin), { replace: true })}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
