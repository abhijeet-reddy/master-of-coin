import type { ReactNode } from 'react';
import * as RDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { IconButton } from './Button';
import { cx } from './cx';
import { ControlSize } from './types';
import styles from './Overlay.module.css';

export interface OverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children: ReactNode;
  /** Sticky footer, usually the action buttons. */
  footer?: ReactNode;
  description?: ReactNode;
  /** Extra header buttons, left of the close button. */
  actions?: ReactNode;
}

enum Kind {
  Modal = 'modal',
  Drawer = 'drawer',
  Sheet = 'sheet',
}

function Surface({
  kind,
  open,
  onOpenChange,
  title,
  description,
  actions,
  footer,
  children,
  hazard,
  wide,
}: OverlayProps & { kind: Kind; hazard?: boolean; wide?: boolean }) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className={styles.scrim} />
        <RDialog.Content
          className={cx(styles.surface, styles[kind], wide && styles.wide)}
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <div>
            {hazard ? <div className={styles.hazard} aria-hidden /> : null}
            <div className={styles.head}>
              <div className={styles.titles}>
                <RDialog.Title className={styles.title}>{title}</RDialog.Title>
                {description ? (
                  <RDialog.Description className={styles.desc}>{description}</RDialog.Description>
                ) : null}
              </div>
              <div className={styles.headActions}>
                {actions}
                <RDialog.Close asChild>
                  <IconButton label="Close" icon={<X />} size={ControlSize.Sm} />
                </RDialog.Close>
              </div>
            </div>
          </div>
          <div className={styles.body}>{children}</div>
          {footer ? <div className={styles.foot}>{footer}</div> : <div />}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

/** Centred modal for short forms and confirmations; `wide` for tables (e.g. an import preview). */
export function Dialog(props: OverlayProps & { hazard?: boolean; wide?: boolean }) {
  return <Surface kind={Kind.Modal} {...props} />;
}

/** Right-hand panel for record detail; a bottom sheet on phones. */
export function Drawer(props: OverlayProps) {
  return <Surface kind={Kind.Drawer} {...props} />;
}

/** Bottom sheet (phone navigation, filter sheets). */
export function Sheet(props: OverlayProps) {
  return <Surface kind={Kind.Sheet} {...props} />;
}
