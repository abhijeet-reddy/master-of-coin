import { useId } from 'react';
import { PERIODS, PERIOD_LABEL, type PeriodFilter as Filter } from '../lib/budgetsModel';
import styles from './Budgets.module.css';

const OPTIONS: Filter[] = ['ALL', ...PERIODS];

interface Props {
  value: Filter;
  counts: Record<Filter, number>;
  onChange: (value: Filter) => void;
}

/** All or one period, each with how many budgets it has; empty periods are disabled. */
export function PeriodFilter({ value, counts, onChange }: Props) {
  const id = useId();
  return (
    <div className={styles.filterBar}>
      <div className={styles.filterGroup}>
        <span className={styles.label} id={id}>
          Period
        </span>
        <div className={styles.seg} role="group" aria-labelledby={id}>
          {OPTIONS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={value === p}
              disabled={!counts[p] && value !== p}
              onClick={() => onChange(p)}
            >
              {p === 'ALL' ? 'All' : PERIOD_LABEL[p]}
              <span className={styles.segCount}>{counts[p]}</span>
            </button>
          ))}
        </div>
      </div>
      <span className={styles.micro}>
        Status: OK under 80%, Warning 80 to 100%, Exceeded over 100%
      </span>
    </div>
  );
}
