import { Gauge as GaugeIcon, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Category } from '@/api/types';
import { usePreferences } from '@/lib/preferences';
import { Badge, ControlSize, IconButton, Menu, MenuItem, MenuSeparator, Meter } from '@/ui';
import { useBudgetDialogs } from '../hooks/budgetDialogs';
import { PACE_LABEL, PERIOD_LABEL, Pace, type BudgetStats } from '../lib/budgetsModel';
import { healthTone } from '../lib/health';
import { CategoryTag, HealthBadge } from './BudgetTags';
import { Gauge } from './Gauge';
import styles from './Budgets.module.css';
import { cx } from '@/ui/cx';

interface Props {
  s: BudgetStats;
  categories: Map<string, Category>;
  selected: boolean;
  onSelect: (id: string) => void;
}

/** One budget: gauge with a pace tick, status, category and period, figures, meter and pace. */
export function BudgetCard({ s, categories, selected, onSelect }: Props) {
  const { fmt } = usePreferences();
  const navigate = useNavigate();
  const dialogs = useBudgetDialogs();
  const b = s.budget;
  const headingId = `bud-${b.id}`;
  const cur = s.currency;
  const over = s.remaining < 0;
  return (
    <article
      className={cx(styles.card, 'moc-sweep')}
      data-selected={selected}
      aria-labelledby={headingId}
    >
      <Gauge percent={s.percent} health={s.health} stroke={7} pace={s.active ? s.elapsedPct : null}>
        <span className={styles.readSmall}>{s.active ? fmt.percent(s.percent) : '--'}</span>
      </Gauge>
      <div className={styles.cardMain}>
        <div className={styles.row}>
          <h3 className={styles.cardName}>
            <button
              type="button"
              id={headingId}
              aria-pressed={selected}
              onClick={() => onSelect(b.id)}
            >
              {b.name}
            </button>
          </h3>
          <span className={styles.cardTools}>
            <HealthBadge health={s.health} />
            <Menu
              label={`Actions for ${b.name}`}
              trigger={
                <IconButton
                  label={`Actions for ${b.name}`}
                  icon={<MoreHorizontal />}
                  size={ControlSize.Sm}
                />
              }
            >
              <MenuItem
                icon={<GaugeIcon aria-hidden />}
                onSelect={() => void navigate(`/budgets/${b.id}`)}
              >
                Open details
              </MenuItem>
              <MenuItem icon={<Pencil aria-hidden />} onSelect={() => dialogs.openEdit(b)}>
                Edit
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                icon={<Trash2 aria-hidden />}
                danger
                onSelect={() => dialogs.confirmDelete(b)}
              >
                Delete
              </MenuItem>
            </Menu>
          </span>
        </div>
        <div className={styles.tags}>
          <CategoryTag categoryId={b.filters?.category_id} categories={categories} />
          {s.period ? <Badge>{PERIOD_LABEL[s.period]}</Badge> : null}
        </div>
        {s.active ? (
          <>
            <dl className={styles.nums}>
              <div>
                <dt>Limit</dt>
                <dd>{fmt.money(s.limit, cur)}</dd>
              </div>
              <div>
                <dt>Spent</dt>
                <dd>{fmt.money(s.spent, cur)}</dd>
              </div>
              <div>
                <dt>{over ? 'Over' : 'Left'}</dt>
                <dd className={over ? styles.neg : undefined}>
                  {fmt.money(Math.abs(s.remaining), cur)}
                </dd>
              </div>
            </dl>
            <div className={styles.meterWrap}>
              <Meter
                percent={s.percent}
                label={`${b.name} budget`}
                pace={s.elapsedPct}
                tone={healthTone(s.health)}
              />
            </div>
            <div className={styles.foot}>
              <span>
                {s.daysLeft} {s.daysLeft === 1 ? 'day' : 'days'} left
              </span>
              <span className={s.pace === Pace.OnTrack ? undefined : styles.ahead}>
                {PACE_LABEL[s.pace]}
              </span>
            </div>
          </>
        ) : (
          <div className={styles.foot}>
            <span>No range covers today</span>
          </div>
        )}
      </div>
    </article>
  );
}
