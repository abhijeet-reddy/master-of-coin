import { useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PageActionsContext } from './routeMeta';

/**
 * Page-level buttons, rendered beside the page title. Outside the shell (or
 * before the slot mounts) they render in place.
 */
export function PageActions({ children }: { children: ReactNode }) {
  const ctx = useContext(PageActionsContext);
  if (!ctx) return <>{children}</>;
  return ctx.target ? createPortal(children, ctx.target) : null;
}
