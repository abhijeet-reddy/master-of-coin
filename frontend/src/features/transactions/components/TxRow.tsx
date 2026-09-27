import { ArrowLeftRight, Copy, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { memo } from 'react';
import { Checkbox, cx, IconButton, Menu, MenuItem, MenuSeparator, Money, SignDisplay } from '@/ui';
import { useTxDialogs } from '../hooks/txDialogs';
import type { LedgerRow } from '../lib/ledger';
import { TxBadges } from './TxBadges';
import { TxTile } from './TxTile';
import styles from './Transactions.module.css';

interface Props {
  row: LedgerRow;
  base: string;
  selected: boolean;
  onToggle: (id: string, on: boolean) => void;
  onOpen: (id: string) => void;
}

/** One ledger row. The title button covers the row, so a click anywhere opens the drawer. */
export const TxRow = memo(function TxRow({ row, base, selected, onToggle, onOpen }: Props) {
  const dialogs = useTxDialogs();
  const { tx } = row;
  const title = tx.title || 'Untitled';
  return (
    <div className={styles.lrWrap}>
      <div className={cx(styles.lr, selected && styles.sel)}>
        <span className={cx(styles.cb, styles.front)}>
          <Checkbox
            checked={selected}
            onCheckedChange={(on) => onToggle(tx.id, on)}
            aria-label={`Select ${title}`}
          />
        </span>
        <TxTile row={row} />
        <div className={styles.lrMain}>
          <button type="button" className={styles.open} onClick={() => onOpen(tx.id)}>
            {title}
          </button>
          <div className={styles.lrMeta}>
            {row.transfer ? 'Transfer' : (row.category?.name ?? 'Uncategorised')}
            <span className={styles.sl} aria-hidden>
              /
            </span>
            <span className="sr-only">, </span>
            {row.accountName}
          </div>
          <div className={styles.badges}>
            <TxBadges row={row} base={base} />
          </div>
        </div>
        <div className={styles.lrAmt}>
          <Money
            amount={row.amount}
            currency={row.currency}
            sign={SignDisplay.Always}
            converted={row.converted == null ? null : { amount: row.converted, currency: base }}
          />
        </div>
        <span className={cx(styles.front, styles.kebab)}>
          <Menu
            label={`Actions for ${title}`}
            trigger={<IconButton label={`More actions for ${title}`} icon={<MoreVertical />} />}
          >
            <MenuItem icon={<Pencil />} onSelect={() => dialogs.openEdit(tx)}>
              Edit
            </MenuItem>
            <MenuItem
              icon={<Copy />}
              onSelect={() => dialogs.openDuplicate(tx)}
              disabled={!!tx.transfer_info}
            >
              Duplicate
            </MenuItem>
            {!tx.transfer_info && !tx.debt_metadata ? (
              <MenuItem icon={<ArrowLeftRight />} onSelect={() => dialogs.openConvert(tx)}>
                Convert to transfer
              </MenuItem>
            ) : null}
            <MenuSeparator />
            <MenuItem icon={<Trash2 />} danger onSelect={() => dialogs.confirmDelete(tx)}>
              Delete
            </MenuItem>
          </Menu>
        </span>
      </div>
    </div>
  );
});
