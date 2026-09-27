import type { ReactNode } from 'react';
import { CircleAlert, Info, TriangleAlert } from 'lucide-react';
import { AlertKind } from './alertKind';
import styles from './dialogs/Dialogs.module.css';

const ICON = { error: CircleAlert, warn: TriangleAlert, info: Info } as const;

/** Inline message inside a form or dialog. The icon and words carry the meaning. */
export function FormAlert({
  kind = AlertKind.Error,
  children,
}: {
  kind?: AlertKind;
  children: ReactNode;
}) {
  const Icon = ICON[kind];
  return (
    <p className={styles[kind]} role={kind === AlertKind.Error ? 'alert' : 'status'}>
      <Icon aria-hidden />
      <span>{children}</span>
    </p>
  );
}
