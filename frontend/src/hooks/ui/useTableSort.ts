import { useState } from 'react';

export interface SortState<T = string> {
  key: T;
  order: 'asc' | 'desc';
}

/**
 * Manage table sort state
 * CONSTRAINT: Uses exactly 1 useState
 *
 * @param initialSort - Initial sort state
 * @returns Sort state and toggle function
 */
export default function useTableSort<T = string>(initialSort: SortState<T>) {
  const [sort, setSort] = useState<SortState<T>>(initialSort);

  const toggleSort = (key: T) => {
    setSort((prev) => ({
      key,
      order: prev.key === key && prev.order === 'asc' ? 'desc' : 'asc',
    }));
  };

  return { sort, setSort, toggleSort };
}
