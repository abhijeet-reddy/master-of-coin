import { Link } from 'react-router-dom';
import {
  CircleAlert,
  CircleCheck,
  OctagonX,
  Pause,
  Play,
  TriangleAlert,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { IconButton } from '@/ui';
import { useCountUp } from '@/ui/useCountUp';
import { ButtonVariant, ControlSize } from '@/ui/types';
import { SignDisplay } from '@/lib/format';
import { usePreferences } from '@/lib/preferences';
import { useTheme } from '@/design';
import { JobStatus } from '@/api/types/jobs';
import { AlertTone, type StripAlert } from './alerts';
import { ROTATE_MS, useAlertRotation } from './useAlertRotation';
import { useStatusStrip } from './useStatusStrip';
import styles from './StatusStrip.module.css';

const TONE_ICON = {
  [AlertTone.Crit]: OctagonX,
  [AlertTone.Warn]: TriangleAlert,
  [AlertTone.Info]: TrendingDown,
  [AlertTone.Pos]: TrendingUp,
};

/** The telemetry bar: fixed slots plus one rotating alert. */
export function StatusStrip() {
  const data = useStatusStrip();
  const { fmt } = usePreferences();
  const b = data.budgets;
  const sync = data.lastSync;
  const netWorth = useCountUp(data.netWorth ?? 0, data.netWorth !== null);
  const monthNet = useCountUp(data.monthNet ?? 0, data.monthNet !== null);

  return (
    <div className={styles.strip} role="region" aria-label="Status">
      <Link className={`${styles.slot} ${styles.nw}`} to="/accounts">
        <span className={styles.k}>Net worth</span>
        <span className={styles.v}>
          {data.netWorth === null ? '--' : fmt.money(netWorth ?? data.netWorth)}
        </span>
      </Link>
      <Link className={`${styles.slot} ${styles.mn}`} to="/transactions">
        <span className={styles.k}>{data.monthLabel} net</span>
        <span className={`${styles.v} ${toneOf(data.monthNet)}`}>
          {data.monthNet === null
            ? '--'
            : fmt.money(monthNet ?? data.monthNet, undefined, { sign: SignDisplay.Always })}
        </span>
      </Link>
      <Link className={`${styles.slot} ${styles.bd}`} to="/budgets">
        <span className={styles.k}>Budgets</span>
        <span className={styles.v}>
          {!b ? (
            '--'
          ) : b.over + b.warning === 0 ? (
            <span className={styles.pos}>{b.total ? 'All OK' : 'None'}</span>
          ) : (
            <span>
              {b.over ? <span className={styles.neg}>{b.over} over</span> : null}
              {b.over && b.warning ? ', ' : null}
              {b.warning ? <span className={styles.wrn}>{b.warning} warning</span> : null}
            </span>
          )}
        </span>
      </Link>
      <Link className={`${styles.slot} ${styles.sy}`} to="/jobs">
        <span className={styles.k}>Last sync</span>
        <span className={styles.v}>
          {sync ? (
            <>
              <i
                className={sync.status === JobStatus.FAILED ? styles.dotCrit : styles.dot}
                aria-hidden
              />
              {sync.status === JobStatus.FAILED ? 'Failed ' : ''}
              {fmt.relative(sync.completed_at ?? sync.created_at)}
            </>
          ) : data.syncLoaded ? (
            'Never'
          ) : (
            '--'
          )}
        </span>
      </Link>
      <AlertSlot alerts={data.alerts} />
    </div>
  );
}

function AlertSlot({ alerts }: { alerts: StripAlert[] }) {
  const { reducedMotion } = useTheme();
  const { index, paused, togglePause, holdHandlers } = useAlertRotation(
    alerts.length,
    ROTATE_MS,
    reducedMotion
  );
  const n = alerts.length;
  return (
    <div className={styles.alert} {...holdHandlers}>
      <span className={styles.k}>
        Alerts{n ? <b className={styles.idx}>{`${index + 1}/${n}`}</b> : null}
      </span>
      <div className={styles.win}>
        {n > 1 && !paused ? (
          <i
            key={index}
            className={styles.life}
            style={{ animationDuration: `${ROTATE_MS}ms` }}
            aria-hidden
          />
        ) : null}
        {n === 0 ? (
          <span className={`${styles.item} ${styles.on} ${styles.tPos}`}>
            <CircleCheck aria-hidden />
            <span>All clear</span>
          </span>
        ) : (
          alerts.map((a, i) => {
            const Icon = TONE_ICON[a.tone] ?? CircleAlert;
            const on = i === index;
            return (
              <Link
                key={a.id}
                to={a.href}
                className={`${styles.item} ${styles[`t-${a.tone}`]} ${on ? styles.on : ''}`}
                tabIndex={on ? undefined : -1}
                aria-hidden={on ? undefined : true}
              >
                <Icon aria-hidden />
                <span>
                  {a.lead} <b>{a.value}</b>
                  {a.tail ? ` ${a.tail}` : ''}
                </span>
              </Link>
            );
          })
        )}
      </div>
      {n > 1 ? (
        <IconButton
          label={paused ? 'Play alerts' : 'Pause alerts'}
          icon={paused ? <Play /> : <Pause />}
          variant={ButtonVariant.Ghost}
          size={ControlSize.Sm}
          aria-pressed={paused}
          onClick={togglePause}
        />
      ) : null}
    </div>
  );
}

function toneOf(n: number | null): string {
  if (n === null || n === 0) return '';
  return n > 0 ? styles.pos : styles.neg;
}
