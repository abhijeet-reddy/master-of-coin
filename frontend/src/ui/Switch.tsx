import { useId, type ReactNode } from 'react';
import * as RSwitch from '@radix-ui/react-switch';
import styles from './Toggle.module.css';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  /** Secondary line under the label. */
  description?: ReactNode;
  disabled?: boolean;
}

export function Switch({ checked, onCheckedChange, label, description, disabled }: SwitchProps) {
  const id = useId();
  const descId = description ? `${id}-d` : undefined;
  return (
    <label className={styles.row} htmlFor={id}>
      <RSwitch.Root
        id={id}
        className={styles.track}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-describedby={descId}
      >
        <RSwitch.Thumb className={styles.thumb} />
      </RSwitch.Root>
      <span className={styles.text}>
        <span>{label}</span>
        {description ? (
          <span id={descId} className={styles.desc}>
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}
