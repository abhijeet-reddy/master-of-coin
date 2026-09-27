import { Download, Plus } from 'lucide-react';
import { DateStyle } from '@/lib/format';
import type { BulkSelection } from '@/lib/useBulkSelection';
import { usePreferences } from '@/lib/preferences';
import type { PaginatedResponse, Transaction } from '@/api/types';
import {
  Button,
  ButtonVariant,
  Checkbox,
  EmptyState,
  ErrorState,
  Money,
  Pagination,
  SignDisplay,
  Skeleton,
} from '@/ui';
import { useTxDialogs } from '../hooks/txDialogs';
import type { TransactionFiltersApi } from '../hooks/useTransactionFilters';
import { activeFilterCount, PAGE_SIZE } from '../lib/filters';
import type { DayGroup } from '../lib/ledger';
import { TxRow } from './TxRow';
import styles from './Transactions.module.css';

interface Props {
  f: TransactionFiltersApi;
  groups: DayGroup[];
  query: {
    data?: PaginatedResponse<Transaction>;
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    isFetching: boolean;
    refetch: () => unknown;
  };
  base: string;
  selection: BulkSelection;
  onOpen: (id: string) => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayLabel(day: string, fmt: (d: Date) => string) {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAYS[date.getDay()]} ${fmt(date)}`;
}

/** The ledger panel: header with select-all and count, rows grouped by day, pagination. */
export function Ledger({ f, groups, query, base, selection, onOpen }: Props) {
  const { fmt } = usePreferences();
  const dialogs = useTxDialogs();
  const rows = query.data?.data ?? [];
  const total = query.data?.pagination.total ?? 0;
  const ids = rows.map((t) => t.id);
  const filtered = activeFilterCount(f.filters) > 0;
  const page = f.filters.page;
  const from = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const to = (page - 1) * PAGE_SIZE + rows.length;
  const scopeId = f.scope?.accountId;
  const canAdd = f.scope?.canAdd ?? true;
  const emptyNote = f.scope?.emptyNote ?? 'Nothing recorded for this month.';

  let body;
  if (query.isLoading) {
    body = (
      <div className={`${styles.lgBody} moc-stagger`} aria-busy>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className={styles.skelRow}>
            <Skeleton width={16} height={16} />
            <Skeleton width={36} height={36} />
            <div className={styles.skelLines}>
              <Skeleton width="55%" height={12} />
              <Skeleton width="35%" height={9} />
            </div>
            <Skeleton width={70} height={12} />
            <span />
          </div>
        ))}
      </div>
    );
  } else if (query.isError) {
    body = (
      <div className={styles.stateBox}>
        <ErrorState
          error={query.error}
          title="Could not load transactions"
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  } else if (!rows.length) {
    body = (
      <div className={styles.stateBox}>
        {filtered ? (
          <EmptyState
            title="Nothing matches"
            description="No transactions match these filters for this period. Loosen a filter or clear them all."
            action={<Button onClick={f.clear}>Clear filters</Button>}
          />
        ) : (
          <EmptyState
            title="No transactions yet"
            description={
              canAdd ? `${emptyNote} Add one, or import a CSV from your bank.` : emptyNote
            }
            action={
              canAdd ? (
                <>
                  <Button
                    icon={<Download aria-hidden />}
                    onClick={() => dialogs.openImport(scopeId)}
                  >
                    Import CSV
                  </Button>
                  <Button
                    variant={ButtonVariant.Primary}
                    icon={<Plus aria-hidden />}
                    onClick={() => dialogs.openCreate(scopeId)}
                  >
                    Add transaction
                  </Button>
                </>
              ) : undefined
            }
          />
        )}
      </div>
    );
  } else {
    body = (
      <div className={`${styles.lgBody} moc-stagger`}>
        {groups.map((g) => (
          <section
            key={g.day}
            className={styles.day}
            aria-label={fmt.date(g.day, DateStyle.Medium)}
          >
            <h3 className={styles.lday}>
              <span>{dayLabel(g.day, (d) => fmt.date(d, DateStyle.DayMonth))}</span>
              <span className={styles.ldaySub}>
                <span>{g.rows.length} txn</span>
                <span>
                  <span className="sr-only">Day total </span>
                  <Money amount={g.subtotal} currency={base} sign={SignDisplay.Always} />
                  {g.missing.length ? (
                    <span title={`No rate for ${g.missing.join(', ')}`}> partial</span>
                  ) : null}
                </span>
              </span>
            </h3>
            {g.rows.map((r) => (
              <TxRow
                key={r.tx.id}
                row={r}
                base={base}
                selected={selection.isSelected(r.tx.id)}
                onToggle={selection.toggle}
                onOpen={onOpen}
              />
            ))}
          </section>
        ))}
      </div>
    );
  }

  return (
    <section
      className={styles.ledger}
      aria-labelledby="tx-ledger-title"
      aria-busy={query.isFetching || undefined}
    >
      <header className={`${styles.ph} ${styles.lgTop}`}>
        <div className={styles.phMeta}>
          <Checkbox
            checked={selection.pageState(ids)}
            onCheckedChange={() => selection.togglePage(ids)}
            aria-label="Select all on this page"
            disabled={!ids.length}
          />
          <h2 id="tx-ledger-title" className={styles.phTitle}>
            Ledger
          </h2>
        </div>
        <span className={styles.micro} aria-live="polite">
          {query.isLoading ? (
            'Loading'
          ) : total ? (
            <>
              Showing <b>{from}</b> to <b>{to}</b> of <b>{total}</b>
            </>
          ) : (
            'No rows'
          )}
        </span>
      </header>
      {body}
      {total > PAGE_SIZE ? (
        <div className={styles.foot}>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={f.setPage} />
        </div>
      ) : null}
    </section>
  );
}
