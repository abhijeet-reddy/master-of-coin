import type { InputHTMLAttributes, ReactNode, Ref, TextareaHTMLAttributes } from 'react';
import { cx } from './cx';
import { useFieldControl } from './fieldContext';
import controls from './controls.module.css';
import styles from './Input.module.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Decorative icon inside the left edge (e.g. a search glass). */
  leading?: ReactNode;
  /** Right-aligned tabular figures, for amounts. */
  numeric?: boolean;
  ref?: Ref<HTMLInputElement>;
}

export function Input({ leading, numeric = false, className, ...rest }: InputProps) {
  const a11y = useFieldControl(rest);
  const input = (
    <input
      {...rest}
      {...a11y}
      inputMode={rest.inputMode ?? (numeric ? 'decimal' : undefined)}
      className={cx(
        controls.control,
        leading ? styles.withLead : undefined,
        numeric && styles.num,
        className
      )}
    />
  );
  if (!leading) return input;
  return (
    <span className={styles.wrap}>
      <span className={styles.lead} aria-hidden>
        {leading}
      </span>
      {input}
    </span>
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: Ref<HTMLTextAreaElement>;
}

export function Textarea({ className, ...rest }: TextareaProps) {
  const a11y = useFieldControl(rest);
  return (
    <textarea {...rest} {...a11y} className={cx(controls.control, styles.textarea, className)} />
  );
}
