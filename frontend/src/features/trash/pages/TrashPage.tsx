import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import type { Transaction } from '@/api/types';
import { PageActions } from '@/app/shell/PageActions';
import { useLedgerContext } from '@/features/transactions/hooks/useTxQueries';
import { useRestore } from '@/features/transactions/hooks/useTxMutations';
import { u, useUrlState } from '@/lib/urlState';
import { useBulkSelection } from '@/lib/useBulkSelection';
import {
  Button,
  ButtonVariant,
  Checkbox,
  ConfirmDialog,
  ControlSize,
  EmptyState,
  Pagination,
  Panel,
  PanelState,
  Skeleton,
} from '@/ui';
import { TrashRow } from '../components/TrashRow';
import { useDeleteForever, useTrash } from '../hooks/useTrash';
import { PAGE_SIZE, pageAfterRemoval } from '../lib/trashModel';
import styles from '../components/Trash.module.css';

const schema = z.object({ page: u.number(1) });

/** `/trash`: deleted transactions, restorable until the retention cleanup removes them. */
export function TrashPage() {
  const [params, setParams] = useUrlState(schema);
  const page = Math.max(1, Math.floor(params.page));
  const trash = useTrash(page);
  const ctx = useLedgerContext();
  const selection = useBulkSelection();
  const restore = useRestore();
  const del = useDeleteForever();
  const [restoring, setRestoring] = useState<ReadonlySet<string>>(new Set());
  const [confirm, setConfirm] = useState<Transaction | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const total = trash.data?.pagination.total ?? 0;

  const doRestore = async (ids: string[]) => {
    setRestoring((s) => new Set([...s, ...ids]));
    try {
      await restore(ids);
      selection.remove(ids);
      setParams({ page: pageAfterRemoval(page, total, ids.length) });
    } finally {
      setRestoring((s) => new Set([...s].filter((id) => !ids.includes(id))));
    }
  };
  const selectedIds = [...selection.selected];
  const bulkBusy = selectedIds.some((id) => restoring.has(id));

  return (
    <div className={styles.page}>
      <PageActions>
        {selection.count ? (
          <Button
            variant={ButtonVariant.Primary}
            icon={<RotateCcw aria-hidden />}
            loading={bulkBusy}
            onClick={() => void doRestore(selectedIds)}
          >
            Restore {selection.count} selected
          </Button>
        ) : null}
      </PageActions>
      <p className={styles.intro}>
        Deleted transactions stay here until the retention cleanup removes them. Restoring puts a
        transaction back with its splits and balances.
      </p>
      <Panel
        title="Deleted transactions"
        flush
        actions={trash.data ? <span className={styles.micro}>{total} in trash</span> : undefined}
      >
        <PanelState
          query={trash}
          skeleton={<ListSkeleton />}
          empty={(d) =>
            d.data.length === 0 ? (
              page > 1 && total > 0 ? (
                <EmptyState
                  compact
                  title="This page is empty"
                  action={<Button onClick={() => setParams({ page: 1 })}>First page</Button>}
                />
              ) : (
                <EmptyState
                  title="Trash is empty"
                  description="Transactions you delete land here first."
                />
              )
            ) : null
          }
        >
          {(d) => {
            const ids = d.data.map((t) => t.id);
            return (
              <>
                <div className={styles.bar}>
                  <div className={styles.barLeft}>
                    <Checkbox
                      checked={selection.pageState(ids)}
                      onCheckedChange={() => selection.togglePage(ids)}
                      label="Select page"
                    />
                    {selection.count ? (
                      <>
                        <span className={styles.micro}>{selection.count} selected</span>
                        <Button
                          size={ControlSize.Sm}
                          variant={ButtonVariant.Ghost}
                          onClick={selection.clear}
                        >
                          Clear
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
                <ul className={styles.list} aria-label="Deleted transactions">
                  {d.data.map((tx) => (
                    <TrashRow
                      key={tx.id}
                      tx={tx}
                      account={ctx.accounts.get(tx.account_id)}
                      category={tx.category_id ? ctx.categories.get(tx.category_id) : undefined}
                      selected={selection.isSelected(tx.id)}
                      onToggle={(on) => selection.toggle(tx.id, on)}
                      restoring={restoring.has(tx.id)}
                      onRestore={() => void doRestore([tx.id])}
                      onDelete={() => {
                        setConfirm(tx);
                        setConfirmOpen(true);
                      }}
                    />
                  ))}
                </ul>
                {total > PAGE_SIZE ? (
                  <div className={styles.foot}>
                    <Pagination
                      page={page}
                      pageSize={PAGE_SIZE}
                      total={total}
                      onPageChange={(p) => setParams({ page: p }, { history: 'push' })}
                    />
                  </div>
                ) : null}
              </>
            );
          }}
        </PanelState>
      </Panel>
      {confirm ? (
        <ConfirmDialog
          key={confirm.id}
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={`Delete ${confirm.title} forever?`}
          confirmLabel="Delete forever"
          onConfirm={async () => {
            await del.mutateAsync(confirm);
            selection.remove([confirm.id]);
            setParams({ page: pageAfterRemoval(page, total, 1) });
          }}
        >
          <p className={styles.confirmText}>
            It is removed now, with its splits. This cannot be undone.
          </p>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

function ListSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className={styles.skelRow}>
          <Skeleton width={16} height={16} />
          <Skeleton width="60%" />
          <Skeleton width={90} />
        </div>
      ))}
    </>
  );
}
