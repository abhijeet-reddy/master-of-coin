import { useCallback } from 'react';
import { useUrlState } from '@/lib/urlState';
import { drawerSchema } from '../lib/drawerParam';

/** The `?tx=<id>` drawer param: opening pushes history (back closes it), closing replaces. */
export function useTxDrawer() {
  const [{ tx }, set] = useUrlState(drawerSchema, { history: 'push' });
  const open = useCallback((id: string) => set({ tx: id }), [set]);
  const close = useCallback(() => set({ tx: undefined }, { history: 'replace' }), [set]);
  return { id: tx, open, close };
}
