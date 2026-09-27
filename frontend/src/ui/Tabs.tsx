import type { ReactNode } from 'react';
import * as RTabs from '@radix-ui/react-tabs';
import styles from './Tabs.module.css';

export interface TabItem<V extends string> {
  value: V;
  label: string;
  count?: number;
  disabled?: boolean;
}

export interface TabsProps<V extends string> {
  value: V;
  onValueChange: (value: V) => void;
  items: ReadonlyArray<TabItem<V>>;
  /** <TabPanel> elements, one per item. */
  children: ReactNode;
  label?: string;
}

/** Controlled tabs; pair with useUrlState so the tab lives in the URL. */
export function Tabs<V extends string>({
  value,
  onValueChange,
  items,
  children,
  label,
}: TabsProps<V>) {
  return (
    <RTabs.Root value={value} onValueChange={(v) => onValueChange(v as V)} activationMode="manual">
      <RTabs.List className={styles.list} aria-label={label}>
        {items.map((t) => (
          <RTabs.Trigger key={t.value} value={t.value} disabled={t.disabled} className={styles.tab}>
            {t.label}
            {t.count != null ? <span className={styles.count}>{t.count}</span> : null}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
      {children}
    </RTabs.Root>
  );
}

export function TabPanel({ value, children }: { value: string; children: ReactNode }) {
  return (
    <RTabs.Content value={value} className={styles.panel}>
      {children}
    </RTabs.Content>
  );
}
