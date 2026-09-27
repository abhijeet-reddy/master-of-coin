import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cx } from './cx';
import { CellAlign } from './types';
import styles from './Table.module.css';

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  /** Describes the table for screen readers; visible unless `hideCaption`. */
  caption: ReactNode;
  hideCaption?: boolean;
}

export function Table({ caption, hideCaption = false, className, children, ...rest }: TableProps) {
  return (
    <div className={styles.scroll}>
      <table className={cx(styles.table, className)} {...rest}>
        <caption className={hideCaption ? 'sr-only' : styles.caption}>{caption}</caption>
        {children}
      </table>
    </div>
  );
}

const alignClass = (align?: CellAlign) =>
  align === CellAlign.End ? styles.end : align === CellAlign.Center ? styles.center : undefined;

export interface CellProps {
  align?: CellAlign;
}

export function Th({
  align,
  className,
  scope = 'col',
  ...rest
}: Omit<ThHTMLAttributes<HTMLTableCellElement>, 'align'> & CellProps) {
  return <th scope={scope} className={cx(styles.th, alignClass(align), className)} {...rest} />;
}

export function Td({
  align,
  className,
  ...rest
}: Omit<TdHTMLAttributes<HTMLTableCellElement>, 'align'> & CellProps) {
  return <td className={cx(styles.td, alignClass(align), className)} {...rest} />;
}

export interface TrProps extends HTMLAttributes<HTMLTableRowElement> {
  /** Adds hover affordance; the row still needs a real link or button inside for keyboards. */
  clickable?: boolean;
  selected?: boolean;
}

export function Tr({ clickable, selected, className, ...rest }: TrProps) {
  return (
    <tr
      className={cx(
        styles.row,
        clickable && styles.clickable,
        selected && styles.selected,
        className
      )}
      aria-selected={selected}
      {...rest}
    />
  );
}
