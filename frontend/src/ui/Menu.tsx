import type { ReactNode } from 'react';
import * as RMenu from '@radix-ui/react-dropdown-menu';
import { cx } from './cx';
import { MenuAlign } from './types';
import controls from './controls.module.css';
import styles from './Menu.module.css';

export interface MenuProps {
  /** A single focusable element (Button or IconButton). */
  trigger: ReactNode;
  children: ReactNode;
  align?: MenuAlign;
  /** Accessible name of the menu itself. */
  label?: string;
}

export function Menu({ trigger, children, align = MenuAlign.End, label }: MenuProps) {
  return (
    <RMenu.Root modal={false}>
      <RMenu.Trigger asChild>{trigger}</RMenu.Trigger>
      <RMenu.Portal>
        <RMenu.Content
          className={cx(controls.popover, styles.menu)}
          align={align}
          sideOffset={4}
          aria-label={label}
        >
          {children}
        </RMenu.Content>
      </RMenu.Portal>
    </RMenu.Root>
  );
}

export interface MenuItemProps {
  children: ReactNode;
  onSelect: () => void;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}

export function MenuItem({ children, onSelect, icon, danger, disabled }: MenuItemProps) {
  return (
    <RMenu.Item
      className={cx(styles.item, danger && styles.danger)}
      onSelect={onSelect}
      disabled={disabled}
    >
      {icon}
      <span>{children}</span>
    </RMenu.Item>
  );
}

export function MenuSeparator() {
  return <RMenu.Separator className={styles.sep} />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <RMenu.Label className={styles.label}>{children}</RMenu.Label>;
}
