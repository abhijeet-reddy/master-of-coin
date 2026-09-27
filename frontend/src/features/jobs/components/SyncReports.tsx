import { Link } from 'react-router-dom';
import {
  SyncAction,
  type BulkSyncReport,
  type PortfolioSyncReport,
  type SyncItemResult,
} from '@/api/types';
import {
  Badge,
  CellAlign,
  Money,
  Panel,
  SignDisplay,
  Stat,
  StatGroup,
  Table,
  Td,
  Th,
  Tone,
  Tr,
} from '@/ui';
import { providerName } from '../lib/driftModel';
import { syncItemDetail, syncItemOutcome, SyncOutcome } from '../lib/jobModel';
import styles from './Jobs.module.css';

const OUTCOME: Record<SyncOutcome, { label: string; tone: Tone }> = {
  [SyncOutcome.Done]: { label: 'Done', tone: Tone.Pos },
  [SyncOutcome.Skipped]: { label: 'Skipped', tone: Tone.Neutral },
  [SyncOutcome.Failed]: { label: 'Failed', tone: Tone.Crit },
};

/** Bulk sync result: counts, then what happened to each pushed or pulled item. */
export function BulkSyncReportPanel({ report }: { report: BulkSyncReport }) {
  const s = report.summary;
  return (
    <Panel title="Sync result" flush>
      <StatGroup label="Sync summary">
        <Stat label="Items" value={s.total} />
        <Stat label="Succeeded" value={s.succeeded} />
        <Stat label="Failed" value={s.failed} />
      </StatGroup>
      {report.items.length === 0 ? (
        <p className={styles.empty}>No items in this sync.</p>
      ) : (
        <ul className={styles.items} aria-label="Sync items">
          {report.items.map((it, i) => (
            <SyncItemRow
              key={`${it.transaction_id ?? it.external_expense_id ?? ''}-${i}`}
              item={it}
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function SyncItemRow({ item }: { item: SyncItemResult }) {
  const outcome = OUTCOME[syncItemOutcome(item)];
  const push = item.action === SyncAction.PUSH;
  const detail = syncItemDetail(item);
  return (
    <li className={styles.item}>
      <div className={styles.main}>
        <p className={styles.itemTitle}>
          {item.transaction_id ? (
            <Link to={`/transactions/${item.transaction_id}`}>
              Transaction #{item.transaction_id.slice(0, 8)}
            </Link>
          ) : (
            `Expense #${item.external_expense_id ?? 'unknown'}`
          )}
        </p>
        <span className={styles.meta}>
          <span>
            {push ? 'Push to' : 'Pull from'} {providerName(item.provider_type)}
          </span>
          {detail ? (
            <span className={item.error ? styles.summaryErr : undefined}>{detail}</span>
          ) : null}
        </span>
      </div>
      <span className={styles.itemEnd}>
        <span className={styles.badges}>
          <Badge tone={push ? Tone.Accent : Tone.Neutral}>{push ? 'Push' : 'Pull'}</Badge>
          <Badge tone={outcome.tone}>{outcome.label}</Badge>
        </span>
      </span>
    </li>
  );
}

const PORTFOLIO_STATUS: Record<string, { label: string; tone: Tone }> = {
  synced: { label: 'Synced', tone: Tone.Pos },
  no_change: { label: 'No change', tone: Tone.Neutral },
  failed: { label: 'Failed', tone: Tone.Crit },
};

/** Portfolio sync result: one row per investment account. */
export function PortfolioReportPanel({ report }: { report: PortfolioSyncReport }) {
  return (
    <Panel title="Portfolio result" flush>
      <StatGroup label="Portfolio summary">
        <Stat label="Accounts" value={report.synced_accounts.length} />
        <Stat label="Synced" value={report.total_synced} />
        <Stat label="Failed" value={report.total_failed} />
      </StatGroup>
      {report.synced_accounts.length === 0 ? (
        <p className={styles.empty}>No investment accounts were synced.</p>
      ) : (
        <Table caption="Accounts synced" hideCaption>
          <thead>
            <tr>
              <Th>Account</Th>
              <Th align={CellAlign.End}>Previous</Th>
              <Th align={CellAlign.End}>New value</Th>
              <Th align={CellAlign.End}>Adjustment</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {report.synced_accounts.map((a) => {
              const st = PORTFOLIO_STATUS[a.status] ?? { label: a.status, tone: Tone.Neutral };
              return (
                <Tr key={a.account_id}>
                  <Td>
                    <Link to={`/accounts/${a.account_id}`}>{a.account_name}</Link>
                    {a.error ? <div className={styles.summaryErr}>{a.error}</div> : null}
                  </Td>
                  <Td align={CellAlign.End}>
                    <Money amount={a.previous_balance} />
                  </Td>
                  <Td align={CellAlign.End}>
                    <Money amount={a.new_value} />
                  </Td>
                  <Td align={CellAlign.End}>
                    <Money amount={a.adjustment_amount} sign={SignDisplay.Always} />
                  </Td>
                  <Td>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </Panel>
  );
}
