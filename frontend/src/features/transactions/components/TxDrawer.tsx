import { Maximize2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ButtonVariant, buttonClass, ControlSize, Drawer, ErrorState, Skeleton } from '@/ui';
import { useLedgerContext, useTransaction } from '../hooks/useTxQueries';
import { useTxDrawer } from '../hooks/useTxDrawer';
import { useTxOrigin } from '../lib/txOrigin';
import { TxDetail } from './TxDetail';
import { TxDetailActions } from './TxDetailActions';
import styles from './Transactions.module.css';

/** Row drawer driven by `?tx=<id>`, so it is linkable and the back button closes it. */
export function TxDrawer() {
  const { id, close } = useTxDrawer();
  const query = useTransaction(id);
  const ctx = useLedgerContext();
  const tx = query.data;
  const origin = useTxOrigin();

  return (
    <Drawer
      open={!!id}
      onOpenChange={(o) => !o && close()}
      title="Transaction"
      actions={
        id ? (
          <Link
            to={`/transactions/${id}`}
            state={origin ? { origin } : undefined}
            className={buttonClass(ButtonVariant.Ghost, ControlSize.Sm)}
            aria-label="Open as a full page"
            title="Open as a full page"
          >
            <Maximize2 aria-hidden size={14} />
          </Link>
        ) : null
      }
      footer={tx ? <TxDetailActions tx={tx} onDeleted={close} /> : undefined}
    >
      {query.isLoading || (tx && !ctx.ready) ? (
        <div className={styles.dd}>
          <Skeleton width="70%" height={24} />
          <Skeleton height={90} />
          <Skeleton lines={5} />
        </div>
      ) : query.isError ? (
        <ErrorState
          error={query.error}
          title="Could not load this transaction"
          onRetry={() => void query.refetch()}
        />
      ) : tx ? (
        <TxDetail tx={tx} ctx={ctx} />
      ) : null}
    </Drawer>
  );
}
