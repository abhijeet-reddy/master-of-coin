import { usePreferences } from '@/lib/preferences';
import { Badge, EmptyState, Panel, Tone } from '@/ui';
import { CircleCheck, OctagonAlert, TriangleAlert } from 'lucide-react';
import type { Overall } from '../lib/budgetsModel';
import { Gauge } from './Gauge';
import styles from './Budgets.module.css';

interface Props {
  o: Overall;
  /** "All budgets" or the period shown. */
  scope: string;
  currency: string;
}

/** Combined limit and spend of the budgets shown, with the average of their own usage. */
export function OverallPanel({ o, scope, currency }: Props) {
  const { fmt } = usePreferences();
  const over = o.remaining < 0;
  return (
    <Panel title="Overall" actions={<span className={styles.micro}>{scope}</span>}>
      {o.counted === 0 ? (
        <EmptyState
          compact
          title="Nothing active"
          description="None of these budgets has a range covering today, so there is nothing to add up."
        />
      ) : (
        <div className={styles.ovBody}>
          <Gauge percent={o.percent} health={o.health} size={168} stroke={12}>
            <span className={styles.readBig}>{fmt.percent(o.percent)}</span>
            <span className={`${styles.micro} ${styles.readSub}`}>used</span>
          </Gauge>
          <dl className={styles.kv}>
            <div>
              <dt>Limit</dt>
              <dd>{fmt.money(o.limit, currency)}</dd>
            </div>
            <div>
              <dt>Spent</dt>
              <dd>{fmt.money(o.spent, currency)}</dd>
            </div>
            <div>
              <dt>{over ? 'Over by' : 'Remaining'}</dt>
              <dd className={over ? styles.neg : undefined}>
                {fmt.money(Math.abs(o.remaining), currency)}
              </dd>
            </div>
            <div>
              <dt>Average use</dt>
              <dd title="The mean of each budget's own percentage used">
                {o.averagePercent == null ? '--' : fmt.percent(o.averagePercent, 1)}
              </dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd className={styles.counts}>
                <Badge tone={Tone.Pos} icon={<CircleCheck aria-hidden />}>
                  <span className="sr-only">OK </span>
                  {o.ok}
                </Badge>
                <Badge tone={Tone.Warn} icon={<TriangleAlert aria-hidden />}>
                  <span className="sr-only">Warning </span>
                  {o.warning}
                </Badge>
                <Badge tone={Tone.Crit} icon={<OctagonAlert aria-hidden />}>
                  <span className="sr-only">Exceeded </span>
                  {o.over}
                </Badge>
              </dd>
            </div>
          </dl>
        </div>
      )}
    </Panel>
  );
}
