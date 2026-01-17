import { useMemo } from 'react';
import type { Person, Transaction } from '@/types';

/**
 * Calculate total debt owed and owing from transaction splits
 * CONSTRAINT: No useState (derived data only)
 *
 * @param people - Array of people
 * @param transactions - Array of transactions with splits
 * @returns Calculated debt totals
 */
export default function useDebtCalculator(people: Person[] = [], transactions: Transaction[] = []) {
  const totals = useMemo(() => {
    // Calculate debt per person from transaction splits
    const debtsByPerson = new Map<string, { owesMe: number; iOwe: number }>();

    // Initialize debt tracking for each person
    people.forEach((person) => {
      debtsByPerson.set(person.id, { owesMe: 0, iOwe: 0 });
    });

    // Process each transaction with splits
    transactions.forEach((transaction) => {
      if (!transaction.splits || transaction.splits.length === 0) {
        return;
      }

      // For each split, the amount represents what that person owes (positive) or is owed (negative)
      transaction.splits.forEach((split) => {
        const debt = debtsByPerson.get(split.person_id);
        if (debt) {
          const splitAmount = parseFloat(split.amount);

          // Positive split amount means they owe me (I paid for them)
          // Negative split amount means I owe them (they paid for me)
          if (splitAmount > 0) {
            debt.owesMe += splitAmount;
          } else if (splitAmount < 0) {
            debt.iOwe += Math.abs(splitAmount);
          }
        }
      });
    });

    // Calculate totals
    let totalOwedToMe = 0;
    let totalIOwe = 0;

    debtsByPerson.forEach((debt) => {
      totalOwedToMe += debt.owesMe;
      totalIOwe += debt.iOwe;
    });

    const netBalance = totalOwedToMe - totalIOwe;

    return {
      totalOwedToMe: totalOwedToMe.toFixed(2),
      totalIOwe: totalIOwe.toFixed(2),
      netBalance: netBalance.toFixed(2),
    };
  }, [people, transactions]);

  return totals;
}
