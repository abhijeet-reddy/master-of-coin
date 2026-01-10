import { useMemo } from 'react';
import type { Person } from '@/types';

/**
 * Calculate total debt owed and owing from people data
 * CONSTRAINT: No useState (derived data only)
 *
 * @param people - Array of people with debt summaries
 * @returns Calculated debt totals
 */
export default function useDebtCalculator(people: Person[] = []) {
  const totals = useMemo(() => {
    const totalOwedToMe = people.reduce((sum, person) => {
      return sum + (parseFloat(person.debt_summary?.owes_me || '0') || 0);
    }, 0);

    const totalIOwe = people.reduce((sum, person) => {
      return sum + (parseFloat(person.debt_summary?.i_owe || '0') || 0);
    }, 0);

    const netBalance = totalOwedToMe - totalIOwe;

    return {
      totalOwedToMe: totalOwedToMe.toFixed(2),
      totalIOwe: totalIOwe.toFixed(2),
      netBalance: netBalance.toFixed(2),
    };
  }, [people]);

  return totals;
}
