import type { ReactNode } from 'react';
import * as RTooltip from '@radix-ui/react-tooltip';
import styles from './Tooltip.module.css';

export interface TooltipProps {
  /** Supplementary text only: never the sole place an essential fact lives. */
  content: ReactNode;
  /** One focusable element. */
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  return (
    <RTooltip.Root>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content className={styles.tip} side={side} sideOffset={6}>
          {content}
          <RTooltip.Arrow className={styles.arrow} />
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}

/** Mount once at the root. */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return <RTooltip.Provider delayDuration={400}>{children}</RTooltip.Provider>;
}
