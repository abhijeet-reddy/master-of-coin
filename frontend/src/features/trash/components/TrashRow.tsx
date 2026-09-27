import { RotateCcw, Trash2 } from 'lucide-react';
import type { Account, Category, Transaction } from '@/api/types';
import { DateStyle } from '@/lib/format';
import { usePreferences } from '@/lib/preferences';
import { Button, Checkbox, ControlSize, IconButton, Money, SignDisplay } from '@/ui';
import { daysLeft, isSoon, purgeLabel } from '../lib/trashModel';
import styles from './Trash.module.css';

interface Props {
  tx: Transaction;
  account?: Pick<Account, 'name' | 'currency'>;
  category?: Pick<Category, 'name'>;
  selected: boolean;
  onToggle: (on: boolean) => void;
  restoring: boolean;
  onRestore: () => void;
  onDelete: () => void;
}

/** One deleted transaction: what it was, when it goes for good, and the two ways out. */
export function TrashRow({
  tx,
  account,
  category,
  selected,
  onToggle,
  restoring,
  onRestore,
  onDelete,
}: Props) {
  const { prefs, fmt } = usePreferences();
  const days = daysLeft(tx);
  return (
    <li className={styles.row} data-selected={selected} aria-label={tx.title}>
      <Checkbox checked={selected} onCheckedChange={onToggle} aria-label={`Select ${tx.title}`} />
      <div className={styles.main}>
        <p className={styles.title}>{tx.title}</p>
        <p className={styles.meta}>
          <span>{fmt.date(tx.date, DateStyle.Medium)}</span>
          <span>{account?.name ?? 'Unknown account'}</span>
          {category ? <span>{category.name}</span> : null}
          {tx.transfer_info ? <span>Transfer</span> : null}
        </p>
      </div>
      <span className={styles.amount}>
        <Money
          amount={tx.amount}
          currency={account?.currency ?? prefs.default_currency}
          sign={SignDisplay.Always}
        />
      </span>
      <span className={styles.when}>
        <span>Deleted {tx.deleted_at ? fmt.date(tx.deleted_at, DateStyle.Medium) : ''}</span>
        <span className={isSoon(days) ? styles.soon : undefined}>{purgeLabel(days)}</span>
      </span>
      <span className={styles.actions}>
        <Button
          size={ControlSize.Sm}
          icon={<RotateCcw aria-hidden />}
          loading={restoring}
          onClick={onRestore}
        >
          Restore
        </Button>
        <IconButton
          size={ControlSize.Sm}
          label={`Delete ${tx.title} forever`}
          icon={<Trash2 aria-hidden />}
          onClick={onDelete}
        />
      </span>
    </li>
  );
}
