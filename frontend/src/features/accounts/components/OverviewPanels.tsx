import { TriangleAlert } from 'lucide-react';
import { SignDisplay } from '@/lib/format';
import { usePreferences } from '@/lib/preferences';
import {
  Badge,
  CellAlign,
  Money,
  MoneySize,
  Panel,
  Stat,
  StatGroup,
  Table,
  Td,
  Th,
  Tone,
  Tr,
} from '@/ui';
import { exposure, type AccountsOverview } from '../lib/accountsModel';
import styles from './Accounts.module.css';

/** Net of every account in the base currency, then assets, liabilities and the count. */
export function TotalPanel({ o, base }: { o: AccountsOverview; base: string }) {
  const n = o.currencies.length;
  return (
    <Panel
      title="Total balance"
      actions={
        <span
          className={styles.meta}
        >{`${base} base, ${n} ${n === 1 ? 'currency' : 'currencies'}`}</span>
      }
      flush
    >
      <div className={styles.pad}>
        <div className={styles.hero}>
          <span className={styles.kicker}>All accounts, converted to {base}</span>
          <Money amount={o.net} currency={base} size={MoneySize.Hero} />
          {o.missing.length ? (
            <span className={styles.warnLine}>
              <TriangleAlert aria-hidden />
              No rate for {o.missing.join(', ')}; those accounts are left out.
            </span>
          ) : null}
        </div>
      </div>
      <StatGroup label="Totals">
        <Stat
          label="Assets"
          value={<Money amount={o.assets} currency={base} size={MoneySize.Medium} />}
        />
        <Stat
          label="Liabilities"
          value={<Money amount={o.liabilities} currency={base} size={MoneySize.Medium} />}
        />
        <Stat label="Accounts" value={<span className={styles.count}>{o.count}</span>} />
      </StatGroup>
    </Panel>
  );
}

/** Balance by account type as a share of assets (or of liabilities). */
export function ExposurePanel({ o, base }: { o: AccountsOverview; base: string }) {
  const { fmt } = usePreferences();
  const rows = exposure(o);
  return (
    <Panel
      title="Exposure by type"
      actions={<span className={styles.meta}>{base} equivalent</span>}
    >
      <Table caption="Balance by account type" hideCaption>
        <thead>
          <tr>
            <Th>Type</Th>
            <Th className={styles.barCol}>
              <span className="sr-only">Bar</span>
            </Th>
            <Th align={CellAlign.End}>Share</Th>
            <Th align={CellAlign.End}>{base}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Tr key={r.type}>
              <Td className={styles.nowrap}>
                <Badge tone={r.liability ? Tone.Crit : Tone.Neutral}>{r.tag}</Badge>
                <span className={styles.typeName}>{r.label}</span>
              </Td>
              <Td>
                <span className={styles.bar} aria-hidden>
                  <i
                    className={r.liability ? styles.barCrit : undefined}
                    style={{ transform: `scaleX(${r.width})` }}
                  />
                </span>
              </Td>
              <Td align={CellAlign.End} className={styles.share}>
                {fmt.percent(r.share, 1)}
              </Td>
              <Td align={CellAlign.End}>
                <Money
                  amount={r.total}
                  currency={base}
                  sign={r.liability ? SignDisplay.Auto : SignDisplay.Always}
                />
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <p className={styles.note}>
        Share is of total assets, or of total liabilities for CRD and DBT.
      </p>
    </Panel>
  );
}
