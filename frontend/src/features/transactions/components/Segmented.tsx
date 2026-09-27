import { useId } from 'react';
import type { SelectOption } from '@/ui';
import styles from './dialogs/Dialogs.module.css';

export interface SegmentedProps<V extends string> {
  legend: string;
  value: V;
  options: ReadonlyArray<SelectOption<V>>;
  onChange: (value: V) => void;
  disabled?: boolean;
}

/** A radio group drawn as a segmented control; the checked option is inverted, never colour alone. */
export function Segmented<V extends string>({
  legend,
  value,
  options,
  onChange,
  disabled,
}: SegmentedProps<V>) {
  const name = useId();
  return (
    <fieldset className={styles.segWrap} disabled={disabled}>
      <legend className={styles.segLegend}>{legend}</legend>
      <div className={styles.seg}>
        {options.map((o) => (
          <label key={o.value} className={styles.segOpt}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
