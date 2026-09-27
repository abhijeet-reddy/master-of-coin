import { ArrowLeftRight, Tag } from 'lucide-react';
import type { CSSProperties } from 'react';
import { isSingleGlyph } from '@/lib/emoji';
import { cx } from '@/ui';
import type { LedgerRow } from '../lib/ledger';
import styles from './Transactions.module.css';

/** Category tile: the category's emoji (or a tag glyph) with its colour as the left rule. */
export function TxTile({ row, large }: { row: LedgerRow; large?: boolean }) {
  const icon = row.category?.icon?.trim();
  const style = row.category?.color ? ({ '--c': row.category.color } as CSSProperties) : undefined;
  return (
    <span className={cx(styles.tile, large && styles.tileLg)} style={style} aria-hidden>
      {row.transfer ? <ArrowLeftRight /> : isSingleGlyph(icon) ? icon : <Tag />}
    </span>
  );
}
