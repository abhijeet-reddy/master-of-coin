import { useMemo } from 'react';
import type { Budget, BudgetStatus } from '@/types';

/**
 * Calculate budget status from budget data
 * CONSTRAINT: No useState (derived data only)
 *
 * @param budget - Budget with spending information
 * @returns Budget status and percentage
 */
export default function useBudgetStatus(budget?: Budget) {
  const status = useMemo((): {
    status: BudgetStatus;
    percentage: number;
    isOverBudget: boolean;
  } => {
    if (!budget?.active_range || !budget.current_spending) {
      return { status: 'OK', percentage: 0, isOverBudget: false };
    }

    const spent = parseFloat(budget.current_spending) || 0;
    const limit = parseFloat(budget.active_range.limit_amount) || 0;

    if (limit === 0) {
      return { status: 'OK', percentage: 0, isOverBudget: false };
    }

    const percentage = (spent / limit) * 100;

    let budgetStatus: BudgetStatus = 'OK';
    if (percentage >= 100) {
      budgetStatus = 'EXCEEDED';
    } else if (percentage >= 80) {
      budgetStatus = 'WARNING';
    }

    return {
      status: budgetStatus,
      percentage: Math.round(percentage),
      isOverBudget: percentage >= 100,
    };
  }, [budget]);

  return status;
}
