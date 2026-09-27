/**
 * Selection keyed by id. It survives pagination and refetches: rows on other
 * pages stay selected, and the header checkbox reflects only the visible page.
 */
import { useCallback, useMemo, useState } from 'react';
/** Matches the ui Checkbox's checked prop. */
export type CheckedState = boolean | 'indeterminate';

export interface BulkSelection {
  selected: ReadonlySet<string>;
  count: number;
  isSelected: (id: string) => boolean;
  toggle: (id: string, on?: boolean) => void;
  /** Header checkbox state for the visible ids. */
  pageState: (ids: readonly string[]) => CheckedState;
  /** Select every visible id, or clear them all if they are all selected. */
  togglePage: (ids: readonly string[]) => void;
  /** Drop ids (e.g. after they were deleted). */
  remove: (ids: readonly string[]) => void;
  clear: () => void;
}

export function useBulkSelection(): BulkSelection {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());

  const toggle = useCallback((id: string, on?: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const want = on ?? !prev.has(id);
      if (want) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const togglePage = useCallback((ids: readonly string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const all = ids.length > 0 && ids.every((id) => prev.has(id));
      for (const id of ids) {
        if (all) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }, []);

  const remove = useCallback((ids: readonly string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  return useMemo(
    () => ({
      selected,
      count: selected.size,
      isSelected: (id: string) => selected.has(id),
      toggle,
      pageState: (ids: readonly string[]) => {
        const n = ids.filter((id) => selected.has(id)).length;
        if (n === 0) return false;
        return n === ids.length ? true : 'indeterminate';
      },
      togglePage,
      remove,
      clear,
    }),
    [selected, toggle, togglePage, remove, clear]
  );
}
