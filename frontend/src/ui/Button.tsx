import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { LoaderCircle } from 'lucide-react';
import { cx } from './cx';
import { ButtonVariant, ControlSize } from './types';
import { buttonClass, buttonStyles as styles } from './buttonClass';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ControlSize;
  /** Leading icon (a lucide element). */
  icon?: ReactNode;
  /** Shows a spinner, disables the button and sets aria-busy. */
  loading?: boolean;
  fullWidth?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant = ButtonVariant.Secondary,
  size = ControlSize.Md,
  icon,
  loading = false,
  fullWidth = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(
        variant,
        size,
        cx(loading && styles.loading, fullWidth && styles.full, className)
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <LoaderCircle aria-hidden className={styles.spin} /> : icon}
      <span className={styles.label}>{children}</span>
    </button>
  );
}

export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'icon' | 'fullWidth'> {
  /** Accessible name; also shown as the native tooltip. */
  label: string;
  icon: ReactNode;
}

export function IconButton({
  label,
  icon,
  variant = ButtonVariant.Ghost,
  size = ControlSize.Md,
  loading = false,
  className,
  disabled,
  type = 'button',
  title,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={title ?? label}
      className={buttonClass(variant, size, cx(styles.icon, className))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <LoaderCircle aria-hidden className={styles.spin} /> : icon}
    </button>
  );
}
