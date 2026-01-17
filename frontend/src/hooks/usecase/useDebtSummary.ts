import { useMemo } from 'react';
import { FaArrowUp, FaArrowDown, FaEquals } from 'react-icons/fa';
import type { Person } from '@/types';
import type { IconType } from 'react-icons';

interface DebtSummaryData {
  netAmount: number;
  peopleWithDebts: number;
  netStatus: {
    color: string;
    icon: IconType;
    text: string;
  };
}

/**
 * Calculate debt summary statistics and status
 * CONSTRAINT: No useState (derived data only)
 *
 * @param people - Array of people with debt summaries
 * @param netBalance - Net balance from useDebtCalculator
 * @returns Calculated debt summary data
 */
export default function useDebtSummary(people: Person[] = [], netBalance: string): DebtSummaryData {
  return useMemo(() => {
    const netAmount = parseFloat(netBalance);

    const peopleWithDebts = people.filter(
      (p) => p.debt_summary && parseFloat(p.debt_summary.net) !== 0
    ).length;

    // Determine net status
    const getNetStatus = () => {
      if (netAmount > 0) {
        return { color: 'green.600', icon: FaArrowUp, text: 'Net Positive' };
      } else if (netAmount < 0) {
        return { color: 'red.600', icon: FaArrowDown, text: 'Net Negative' };
      } else {
        return { color: 'gray.600', icon: FaEquals, text: 'Balanced' };
      }
    };

    return {
      netAmount,
      peopleWithDebts,
      netStatus: getNetStatus(),
    };
  }, [people, netBalance]);
}
