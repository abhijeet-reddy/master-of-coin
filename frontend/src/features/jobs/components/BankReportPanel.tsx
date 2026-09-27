import { Download } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BankSyncReport } from '@/api/types/bankProvider';
import { usePreferences } from '@/lib/preferences';
import { Badge, Button, ButtonVariant, ControlSize, cx, Money, Panel, Stat, StatGroup } from '@/ui';
import { bankImportPreload, bankTitle, type BankImportPreload } from '../lib/bankImport';
import styles from './Jobs.module.css';

const ImportDialog = lazy(() =>
  import('@/features/transactions/components/dialogs/ImportDialog').then((m) => ({
    default: m.ImportDialog,
  }))
);

/**
 * Bank sync result: what the bank returned and which rows are new. Import opens the same review
 * as a CSV import, with the bank link kept on every row.
 */
export function BankReportPanel({ report }: { report: BankSyncReport }) {
  const { fmt } = usePreferences();
  const [open, setOpen] = useState(false);
  const [seq, setSeq] = useState(0);
  // Frozen at open: the report refetches after the import and would otherwise unmount the dialog.
  const [snapshot, setSnapshot] = useState<BankImportPreload | null>(null);
  const preload = bankImportPreload(report);
  const s = report.summary;

  const openImport = () => {
    setSnapshot(preload);
    setSeq((n) => n + 1);
    setOpen(true);
  };

  return (
    <Panel
      title="Bank transactions"
      flush
      actions={
        preload ? (
          <Button
            variant={ButtonVariant.Primary}
            size={ControlSize.Sm}
            icon={<Download />}
            onClick={openImport}
          >
            Review and import {preload.rows.length}
          </Button>
        ) : null
      }
    >
      <StatGroup label="Bank sync summary">
        <Stat
          label="Account"
          value={<Link to={`/accounts/${report.account_id}`}>{report.account_name}</Link>}
          foot={report.provider_type}
        />
        <Stat label="Fetched" value={s.total_fetched} />
        <Stat label="New" value={s.new_transactions} />
        <Stat label="Already imported" value={s.already_imported} />
        {report.balance ? (
          <Stat
            label="Bank balance"
            value={<Money amount={report.balance.current} currency={report.balance.currency} />}
            foot={`as of ${fmt.date(report.balance.updated_at)}`}
          />
        ) : null}
      </StatGroup>
      {report.transactions.length === 0 ? (
        <p className={styles.empty}>The bank returned no transactions for this period.</p>
      ) : (
        <ul className={styles.items} aria-label="Bank transactions">
          {report.transactions.map((t) => (
            <li
              key={t.external_id}
              className={cx(styles.item, t.already_imported && styles.imported)}
            >
              <div className={styles.main}>
                <p className={styles.itemTitle}>{bankTitle(t)}</p>
                <span className={styles.meta}>
                  <span>{fmt.date(t.date)}</span>
                  {t.category ? <span>{t.category}</span> : null}
                </span>
              </div>
              <span className={styles.itemEnd}>
                <Money amount={t.amount} currency={t.currency} />
                <Badge>{t.already_imported ? 'Imported' : 'New'}</Badge>
              </span>
            </li>
          ))}
        </ul>
      )}
      {snapshot ? (
        <Suspense fallback={null}>
          <ImportDialog
            key={seq}
            open={open}
            onOpenChange={setOpen}
            preload={snapshot}
            title="Import bank transactions"
            description={`${snapshot.rows.length} new from ${report.account_name}. Edit any row before importing; the bank link is kept.`}
          />
        </Suspense>
      ) : null}
    </Panel>
  );
}
