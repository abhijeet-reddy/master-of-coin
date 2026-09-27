import { cx } from './cx';
import { ButtonVariant, ControlSize } from './types';
import styles from './Button.module.css';

export { styles as buttonStyles };

/** Class for anything that should look like a button (links, Radix triggers). */
export function buttonClass(
  variant: ButtonVariant = ButtonVariant.Secondary,
  size: ControlSize = ControlSize.Md,
  extra?: string
): string {
  return cx(
    styles.btn,
    variant !== ButtonVariant.Secondary && styles[variant],
    size === ControlSize.Sm && styles.sm,
    extra
  );
}
