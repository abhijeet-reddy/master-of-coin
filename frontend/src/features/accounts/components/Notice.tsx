import type { ReactNode } from 'react';
import { CircleAlert, Info, TriangleAlert } from 'lucide-react';
import { NoticeKind } from './noticeKind';
import styles from './Accounts.module.css';

const ICON = {
  [NoticeKind.Error]: CircleAlert,
  [NoticeKind.Warn]: TriangleAlert,
  [NoticeKind.Info]: Info,
};

/** Inline message in a dialog or panel. The icon and words carry the meaning. */
export function Notice({
  kind = NoticeKind.Error,
  children,
}: {
  kind?: NoticeKind;
  children: ReactNode;
}) {
  const Icon = ICON[kind];
  return (
    <p
      className={`${styles.notice} ${styles[kind]}`}
      role={kind === NoticeKind.Error ? 'alert' : 'status'}
    >
      <Icon aria-hidden />
      <span>{children}</span>
    </p>
  );
}
