import { SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { Button, ButtonVariant, ControlSize, Sheet } from '@/ui';
import type { TransactionFiltersApi } from '../hooks/useTransactionFilters';
import { activeFilterCount } from '../lib/filters';
import { FilterChips, FilterFields, SearchField } from './FilterFields';
import styles from './Transactions.module.css';

/** The left rail. On phones it keeps search and a Filters button that opens the rest in a sheet. */
export function FilterRail({ f }: { f: TransactionFiltersApi }) {
  const [open, setOpen] = useState(false);
  const n = activeFilterCount(f.filters);
  return (
    <aside className={styles.rail} aria-labelledby="tx-rail-title">
      <div className={styles.railIn}>
        <header className={styles.ph}>
          <h2 id="tx-rail-title" className={styles.phTitle}>
            Search and filter
          </h2>
          <span className={styles.micro}>
            {n ? (
              <>
                <b>{n}</b> active
              </>
            ) : (
              'None active'
            )}
          </span>
        </header>
        <div className={styles.railPb}>
          <SearchField f={f} />
          <Button
            className={styles.railToggle}
            size={ControlSize.Sm}
            icon={<SlidersHorizontal aria-hidden />}
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
          >
            Filters{n ? ` (${n})` : ''}
          </Button>
          <div className={`${styles.railBody} moc-stagger`}>
            <FilterFields f={f} />
          </div>
          <FilterChips f={f} />
        </div>
      </div>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Filters"
        footer={
          <>
            <Button onClick={f.clear} disabled={!n}>
              Clear filters
            </Button>
            <Button variant={ButtonVariant.Primary} onClick={() => setOpen(false)}>
              Show results
            </Button>
          </>
        }
      >
        <div className={`${styles.sheetBody} moc-stagger`}>
          <FilterFields f={f} />
        </div>
      </Sheet>
    </aside>
  );
}
