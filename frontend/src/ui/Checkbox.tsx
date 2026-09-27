import { useId, type ReactNode } from 'react';
import * as RCheckbox from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import styles from './Toggle.module.css';

export type CheckedState = boolean | 'indeterminate';

export interface CheckboxProps {
  checked: CheckedState;
  onCheckedChange: (checked: boolean) => void;
  /** Visible label. Pass `aria-label` instead for icon-only table cells. */
  label?: ReactNode;
  'aria-label'?: string;
  disabled?: boolean;
  name?: string;
}

export function Checkbox({
  checked,
  onCheckedChange,
  label,
  disabled,
  name,
  ...rest
}: CheckboxProps) {
  const id = useId();
  const box = (
    <RCheckbox.Root
      id={id}
      className={styles.box}
      checked={checked}
      onCheckedChange={(v) => onCheckedChange(v === true)}
      disabled={disabled}
      name={name}
      aria-label={label ? undefined : rest['aria-label']}
    >
      <RCheckbox.Indicator>
        {checked === 'indeterminate' ? <Minus aria-hidden /> : <Check aria-hidden />}
      </RCheckbox.Indicator>
    </RCheckbox.Root>
  );
  if (!label) return box;
  return (
    <label className={styles.row} htmlFor={id}>
      {box}
      <span>{label}</span>
    </label>
  );
}
