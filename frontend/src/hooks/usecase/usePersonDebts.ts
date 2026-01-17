import { useMemo } from 'react';
import type { Person, Transaction, DebtSummary } from '@/types';

/**
 * Calculate debt summary for each person from transaction splits
 *
 * @param people - Array of people
 * @param transactions - Array of transactions with splits
 * @returns Map of person ID to debt summary
 */
export default function usePersonDebts(people: Person[] = [], transactions: Transaction[] = []) {
  const personDebts = useMemo(() => {
    const debtsByPerson = new Map<string, DebtSummary>();

    // Initialize debt tracking for each person
    people.forEach((person) => {
      debtsByPerson.set(person.id, {
        owes_me: '0.00',
        i_owe: '0.00',
        net: '0.00',
      });
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
          let owesMe = parseFloat(debt.owes_me);
          let iOwe = parseFloat(debt.i_owe);

          // Positive split amount means they owe me (I paid for them)
          // Negative split amount means I owe them (they paid for me)
          if (splitAmount > 0) {
            owesMe += splitAmount;
          } else if (splitAmount < 0) {
            iOwe += Math.abs(splitAmount);
          }

          const net = owesMe - iOwe;

          debtsByPerson.set(split.person_id, {
            owes_me: owesMe.toFixed(2),
            i_owe: iOwe.toFixed(2),
            net: net.toFixed(2),
          });
        }
      });
    });

    return debtsByPerson;
  }, [people, transactions]);

  return personDebts;
}
