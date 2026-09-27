import { usePreferences } from '@/lib/preferences';
import type { DebtBalance } from '@/lib/debtCurrency';
import styles from './People.module.css';

/**
 * The debt in the currencies it was made in, under a converted figure. Renders nothing when
 * everything is already in the default currency.
 */
export function NativeAmounts({ balance }: { balance?: DebtBalance }) {
  const { fmt } = usePreferences();
  if (!balance?.foreign) return null;
  return (
    <span className={styles.natives}>
      <span>
        {balance.natives.map((n) => fmt.money(Math.abs(n.amount), n.currency)).join(' + ')}
      </span>
      {balance.missing.length ? (
        <span className={styles.missing}>No rate for {balance.missing.join(', ')}</span>
      ) : null}
    </span>
  );
}
