import { TriangleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Badge,
  EmptyState,
  Money,
  Panel,
  Skeleton,
  Tone,
  buttonClass,
  ButtonVariant,
  ControlSize,
} from '@/ui';
import { usePreferences } from '@/lib/preferences';
import { SignDisplay } from '@/lib/format';
import { useAccountList, useNetWorthHistory } from '../hooks/useDashboardQueries';
import { combineQueries } from '@/lib/panelQuery';
import { balanceSheet, type BalanceSheet } from '../lib/dashboardModel';
import { PanelState } from '@/ui/PanelState';
import styles from './Dashboard.module.css';

/** Assets against liabilities, then one row per account type. */
export function BalanceSheetPanel() {
  const query = combineQueries(useNetWorthHistory(), useAccountList());
  return (
    <Panel
      title="Balance sheet"
      actions={
        <Link to="/accounts" className={buttonClass(ButtonVariant.Ghost, ControlSize.Sm)}>
          Accounts
        </Link>
      }
    >
      <PanelState
        query={query}
        skeleton={<Skeleton lines={7} height={14} />}
        empty={([, accounts]) =>
          accounts.length === 0 ? (
            <EmptyState
              compact
              title="No accounts yet"
              action={
                <Link to="/accounts" className={buttonClass(ButtonVariant.Primary, ControlSize.Sm)}>
                  Add an account
                </Link>
              }
            />
          ) : null
        }
      >
        {([points, accounts]) => (
          <Sheet sheet={balanceSheet(points[points.length - 1]?.by_type, accounts)} />
        )}
      </PanelState>
    </Panel>
  );
}

function Sheet({ sheet }: { sheet: BalanceSheet }) {
  const { fmt } = usePreferences();
  const assetPct = sheet.assetShare * 100;
  return (
    <div className={styles.stack}>
      <div>
        <div className={styles.tape} aria-hidden>
          <span style={{ flexGrow: sheet.assetShare, background: 'var(--ink-2)' }} />
          <span style={{ flexGrow: 1 - sheet.assetShare, background: 'var(--crit)' }} />
        </div>
        <p className={styles.legend}>
          <span>
            <i className={styles.swatch} style={{ background: 'var(--ink-2)' }} />
            Assets {fmt.percent(assetPct)}
          </span>
          <span>
            <i className={styles.swatch} style={{ background: 'var(--crit)' }} />
            Liabilities {fmt.percent(100 - assetPct)}
          </span>
        </p>
      </div>
      <ul className={`${styles.rows} moc-stagger`}>
        {sheet.rows.map((r) => (
          <li key={r.type} className={styles.row}>
            {r.liability ? (
              <Badge tone={Tone.Crit} icon={<TriangleAlert aria-hidden />}>
                Liability
              </Badge>
            ) : (
              <Badge>{r.tag}</Badge>
            )}
            <span className={styles.rowName}>
              {r.label} <span className={styles.dim}>{r.count}</span>
            </span>
            <Money amount={r.total} sign={r.total > 0 ? SignDisplay.Always : SignDisplay.Auto} />
          </li>
        ))}
        <li className={`${styles.row} ${styles.total}`}>
          <span className={styles.rowName}>Net</span>
          <Money amount={sheet.net} />
        </li>
      </ul>
    </div>
  );
}
