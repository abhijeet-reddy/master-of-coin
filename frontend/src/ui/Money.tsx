import { usePreferences } from '@/lib/preferences';
import { Sign, SignDisplay, signOf, type Decimalish } from '@/lib/format';
import { cx } from './cx';
import { MoneySize } from './types';
import styles from './Money.module.css';

export interface MoneyProps {
  amount: Decimalish;
  /** ISO code; defaults to the user's default currency. */
  currency?: string;
  /**
   * Auto (default): balances; negatives get a minus and the critical colour.
   * Always: flows; + in the positive colour, minus in ink.
   * Never: absolute value, no colour.
   */
  sign?: SignDisplay;
  /** Converted equivalent shown under the native amount, e.g. `approx. €41.20`. */
  converted?: { amount: Decimalish; currency: string } | null;
  size?: MoneySize;
  className?: string;
}

function toneClass(sign: Sign, display: SignDisplay): string | undefined {
  if (display === SignDisplay.Never || sign === Sign.Zero) return undefined;
  if (sign === Sign.Pos) return display === SignDisplay.Always ? styles.pos : undefined;
  return display === SignDisplay.Auto ? styles.neg : undefined;
}

/** A money figure: tabular numerals, a real sign character, colour only as reinforcement. */
export function Money({
  amount,
  currency,
  sign = SignDisplay.Auto,
  converted,
  size = MoneySize.Inline,
  className,
}: MoneyProps) {
  const { fmt, prefs } = usePreferences();
  const code = currency ?? prefs.default_currency;
  const text = fmt.money(amount, code, { sign });
  const showEq = converted && converted.currency !== code;
  return (
    <span className={cx(styles.money, size !== MoneySize.Inline && styles[size], className)}>
      <data
        className={cx(styles.value, toneClass(signOf(amount), sign))}
        value={String(amount ?? '')}
      >
        {text}
      </data>
      {showEq ? (
        <span className={styles.eq}>
          approx. {fmt.money(converted.amount, converted.currency, { sign })}
        </span>
      ) : null}
    </span>
  );
}
