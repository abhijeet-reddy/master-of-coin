import { TriangleAlert } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { DriftedItem, DriftReport, MissingOnExternal, MissingOnLocal } from '@/api/types';
import { usePreferences } from '@/lib/preferences';
import { Badge, cx, Money, Panel, SignDisplay, Stat, StatGroup, TabPanel, Tabs } from '@/ui';
import { changedSplitDiffs, compareTotals, providerName } from '../lib/driftModel';
import styles from './Jobs.module.css';

enum DriftTab {
  Drifted = 'drifted',
  MissingExternal = 'missing-external',
  MissingLocal = 'missing-local',
}

/** Drift detection result: counts, then each group of items in a tab. */
export function DriftReportPanel({ report }: { report: DriftReport }) {
  const s = report.summary;
  const first =
    report.drifted.length > 0
      ? DriftTab.Drifted
      : report.missing_on_external.length > 0
        ? DriftTab.MissingExternal
        : report.missing_on_local.length > 0
          ? DriftTab.MissingLocal
          : DriftTab.Drifted;
  const [tab, setTab] = useState<DriftTab>(first);
  return (
    <Panel title="Drift report" flush>
      <StatGroup label="Drift summary">
        <Stat label="Local" value={s.total_local} foot="split transactions" />
        <Stat label="Provider" value={s.total_external} foot="expenses" />
        <Stat label="In sync" value={s.synced} />
        <Stat label="Drifted" value={s.drifted} />
        <Stat label="Missing on provider" value={s.missing_on_external} />
        <Stat label="Missing locally" value={s.missing_on_local} />
      </StatGroup>
      <div className={styles.tabBody}>
        <Tabs
          value={tab}
          onValueChange={setTab}
          label="Drift groups"
          items={[
            { value: DriftTab.Drifted, label: 'Drifted', count: report.drifted.length },
            {
              value: DriftTab.MissingExternal,
              label: 'Missing on provider',
              count: report.missing_on_external.length,
            },
            {
              value: DriftTab.MissingLocal,
              label: 'Missing locally',
              count: report.missing_on_local.length,
            },
          ]}
        >
          <TabPanel value={DriftTab.Drifted}>
            <ItemList label="Drifted" empty="Nothing drifted. Both sides agree.">
              {report.drifted.map((d) => (
                <DriftedRow key={d.transaction_id} item={d} />
              ))}
            </ItemList>
          </TabPanel>
          <TabPanel value={DriftTab.MissingExternal}>
            <ItemList
              label="Missing on provider"
              empty="Every split transaction is on the provider."
            >
              {report.missing_on_external.map((m) => (
                <MissingExternalRow key={m.transaction_id} item={m} />
              ))}
            </ItemList>
          </TabPanel>
          <TabPanel value={DriftTab.MissingLocal}>
            <ItemList label="Missing locally" empty="Every provider expense is here.">
              {report.missing_on_local.map((m) => (
                <MissingLocalRow key={m.external_expense_id} item={m} />
              ))}
            </ItemList>
          </TabPanel>
        </Tabs>
      </div>
    </Panel>
  );
}

function ItemList({
  label,
  empty,
  children,
}: {
  label: string;
  empty: string;
  children: ReactNode[];
}) {
  if (children.length === 0) return <p className={styles.empty}>{empty}</p>;
  return (
    <ul className={`${styles.items} moc-stagger`} aria-label={label}>
      {children}
    </ul>
  );
}

/** "12.00 here, 15.00 on Splitwise" plus the split shares that differ. */
export function DriftDetails({ item }: { item: DriftedItem }) {
  const totals = compareTotals(item);
  const diffs = changedSplitDiffs(item);
  const where = providerName(item.provider_type);
  return (
    <ul className={styles.diffs}>
      <li className={cx(totals.isDifferent && styles.changed)}>
        Total <b>{totals.localTotal}</b> here, <b>{totals.externalTotal}</b> on {where}
        {item.external_description !== item.transaction_title
          ? `, titled "${item.external_description}"`
          : ''}
      </li>
      {diffs.map((d) => (
        <li key={d.name} className={styles.changed}>
          {d.name}: <b>{d.localOwed ?? 'none'}</b> here, <b>{d.externalOwed ?? 'none'}</b> on{' '}
          {where}
        </li>
      ))}
    </ul>
  );
}

function DriftedRow({ item }: { item: DriftedItem }) {
  const { fmt } = usePreferences();
  return (
    <li className={styles.item}>
      <div className={styles.main}>
        <p className={styles.itemTitle}>{item.transaction_title}</p>
        <span className={styles.meta}>
          <span>{fmt.date(item.transaction_date)}</span>
          <span>#{item.external_expense_id}</span>
        </span>
      </div>
      <span className={styles.itemEnd}>
        {item.provider_type ? <Badge>{providerName(item.provider_type)}</Badge> : null}
      </span>
      <DriftDetails item={item} />
    </li>
  );
}

function MissingExternalRow({ item }: { item: MissingOnExternal }) {
  const { fmt } = usePreferences();
  return (
    <li className={styles.item}>
      <div className={styles.main}>
        <p className={styles.itemTitle}>{item.transaction_title}</p>
        <span className={styles.meta}>
          <span>{fmt.date(item.transaction_date)}</span>
          {item.splits.length ? (
            <span>Split with {item.splits.map((s) => s.person_name).join(', ')}</span>
          ) : null}
        </span>
      </div>
      <span className={styles.itemEnd}>
        <span className={styles.dur}>{Math.abs(parseFloat(item.amount) || 0).toFixed(2)}</span>
      </span>
    </li>
  );
}

function MissingLocalRow({ item }: { item: MissingOnLocal }) {
  const { fmt } = usePreferences();
  const unmapped = item.unmapped_users ?? [];
  return (
    <li className={styles.item}>
      <div className={styles.main}>
        <p className={styles.itemTitle}>{item.description}</p>
        <span className={styles.meta}>
          <span>{fmt.date(item.date)}</span>
          {item.provider_type ? <span>{providerName(item.provider_type)}</span> : null}
          {item.users.length ? (
            <span>
              With {item.users.map((u) => `${u.first_name} ${u.last_name}`.trim()).join(', ')}
            </span>
          ) : null}
        </span>
      </div>
      <span className={styles.itemEnd}>
        <Money amount={item.cost} currency={item.currency_code} sign={SignDisplay.Never} />
      </span>
      {unmapped.length ? (
        <p className={cx(styles.warnNote, styles.diffs)}>
          <TriangleAlert aria-hidden />
          <span>
            Not linked to a person here:{' '}
            {unmapped.map((u) => `${u.first_name} ${u.last_name}`.trim()).join(', ')}. Link them on
            People before pulling, or their share is left out.
          </span>
        </p>
      ) : null}
    </li>
  );
}
