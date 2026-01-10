import { useState } from 'react';

/**
 * Manage filter state for lists
 * CONSTRAINT: Uses exactly 1 useState
 *
 * @param initialFilters - Initial filter values
 * @returns Filter state and update functions
 */
export default function useFilters<T extends Record<string, unknown>>(initialFilters: T) {
  const [filters, setFilters] = useState<T>(initialFilters);

  const updateFilter = <K extends keyof T>(key: K, value: T[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => setFilters(initialFilters);

  return { filters, updateFilter, resetFilters, setFilters };
}
