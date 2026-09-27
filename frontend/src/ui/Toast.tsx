import { useSyncExternalStore, type CSSProperties } from 'react';
import * as RToast from '@radix-ui/react-toast';
import { CircleCheck, Info, OctagonX, X } from 'lucide-react';
import { cx } from './cx';
import { dismissToast, toastStore, type ToastItem } from './toastStore';
import { ToastKind } from './types';
import styles from './Toast.module.css';

const ICON = {
  [ToastKind.Info]: Info,
  [ToastKind.Success]: CircleCheck,
  [ToastKind.Error]: OctagonX,
};

function ToastRow({ item }: { item: ToastItem }) {
  const Icon = ICON[item.kind];
  return (
    <RToast.Root
      className={cx(styles.toast, styles[item.kind])}
      duration={item.duration}
      type={item.kind === ToastKind.Error ? 'foreground' : 'background'}
      onOpenChange={(open) => {
        if (!open) dismissToast(item.id);
      }}
      style={{ '--life': `${item.duration}ms` } as CSSProperties}
    >
      <Icon aria-hidden className={styles.icon} />
      <div className={styles.msg}>
        <RToast.Title>{item.title}</RToast.Title>
        {item.description ? (
          <RToast.Description className={styles.desc}>{item.description}</RToast.Description>
        ) : null}
      </div>
      {item.action ? (
        <RToast.Action
          className={styles.action}
          altText={item.action.label}
          onClick={item.action.onClick}
        >
          {item.action.label}
        </RToast.Action>
      ) : null}
      <RToast.Close className={styles.close} aria-label="Dismiss">
        <X aria-hidden />
      </RToast.Close>
      <span className={styles.life} aria-hidden />
    </RToast.Root>
  );
}

/** Mount once, near the root. Toasts are raised with `toast.success(...)` etc. */
export function Toaster() {
  const items = useSyncExternalStore(toastStore.subscribe, toastStore.getSnapshot);
  return (
    <RToast.Provider swipeDirection="right" label="Notifications">
      {items.map((item) => (
        <ToastRow key={item.id} item={item} />
      ))}
      <RToast.Viewport className={styles.viewport} />
    </RToast.Provider>
  );
}
