import { Plus } from 'lucide-react';
import type { Category } from '@/api/types';
import { DateStyle } from '@/lib/format';
import { usePreferences } from '@/lib/preferences';
import { Button, Meter } from '@/ui';
import { useBudgetDialogs } from '../hooks/budgetDialogs';
import { PACE_LABEL, PERIOD_LABEL, Pace, type BudgetStats } from '../lib/budgetsModel';
import { healthTone } from '../lib/health';
import { CategoryTag, HealthBadge } from './BudgetTags';
import styles from './Budgets.module.css';

interface Props {
  s: BudgetStats;
  categories: Map<string, Category>;
  /** Show the big name (the side panel); the detail page has it as the page title. */
  showName?: boolean;
}

/** The current period of one budget: spent of limit, meter, and the figures that explain it. */
export function BudgetSummary({ s, categories, showName = true }: Props) {
  const { fmt } = usePreferences();
  const dialogs = useBudgetDialogs();
  const b = s.budget;
  const cur = s.currency;
  const over = s.remaining < 0;
  return (
    <div className={styles.summary}>
      <div className={styles.sumTop}>
        <CategoryTag categoryId={b.filters?.category_id} categories={categories} />
        <HealthBadge health={s.health} />
      </div>
      {showName ? <p className={styles.bigName}>{b.name}</p> : null}
      {s.active && s.period && s.start && s.end ? (
        <>
          <p className={styles.micro} style={{ margin: showName ? 0 : '12px 0 0' }}>
            {PERIOD_LABEL[s.period]}, {fmt.date(s.start, DateStyle.Medium)} to{' '}
            {fmt.date(s.end, DateStyle.Medium)}
          </p>
          <div className={styles.spentRow}>
            <span className={styles.spentFig}>{fmt.money(s.spent, cur)}</span>
            <span className={styles.of}>of {fmt.money(s.limit, cur)}</span>
          </div>
          <Meter
            percent={s.percent}
            label={`${b.name} budget`}
            pace={s.elapsedPct}
            tone={healthTone(s.health)}
          />
          <dl className={`${styles.kv} ${styles.sumKv}`}>
            <div>
              <dt>Used</dt>
              <dd>{fmt.percent(s.percent, 1)}</dd>
            </div>
            <div>
              <dt>Period elapsed</dt>
              <dd>
                {fmt.percent(s.elapsedPct, 1)} (day {s.elapsed} of {s.totalDays})
              </dd>
            </div>
            <div>
              <dt>Days left</dt>
              <dd>{s.daysLeft}</dd>
            </div>
            <div>
              <dt>{over ? 'Over by' : 'Remaining'}</dt>
              <dd className={over ? styles.neg : undefined}>
                {fmt.money(Math.abs(s.remaining), cur)}
              </dd>
            </div>
            <div>
              <dt>Safe to spend per day</dt>
              <dd>{fmt.money(s.safePerDay, cur)}</dd>
            </div>
            <div>
              <dt>Pace</dt>
              <dd className={s.pace === Pace.OnTrack ? undefined : styles.ahead}>
                {PACE_LABEL[s.pace]}
              </dd>
            </div>
          </dl>
        </>
      ) : (
        <div className={styles.noRange}>
          <p className={styles.confirmText}>
            No range covers today, so nothing is being counted. Add a range with a limit and a
            period to start tracking again.
          </p>
          <Button icon={<Plus aria-hidden />} onClick={() => dialogs.openRange(b)}>
            Add range
          </Button>
        </div>
      )}
    </div>
  );
}
