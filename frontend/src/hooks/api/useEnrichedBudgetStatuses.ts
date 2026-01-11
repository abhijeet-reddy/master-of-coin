import { useMemo } from 'react';
import useBudgets from './useBudgets';
import type { BudgetStatus, EnrichedBudgetStatus, BudgetPeriod } from '@/types';

/**
 * Enriches raw budget status data with budget details (name)
 * Uses cached data from useBudgets hook
 *
 * Note: Since the backend budget_statuses don't include period/dates,
 * we use placeholder values. The important data (name, spending, limit, percentage)
 * comes from the backend.
 *
 * @param rawStatuses - Raw budget statuses from dashboard API
 * @returns Enriched budget statuses with budget names
 */
export default function useEnrichedBudgetStatuses(
  rawStatuses?: BudgetStatus[]
): EnrichedBudgetStatus[] {
  const { data: budgets } = useBudgets();

  return useMemo(() => {
    if (!rawStatuses) {
      return [];
    }

    // If budgets aren't loaded yet, return empty array
    if (!budgets) {
      return [];
    }

    // Create lookup map for efficient access
    const budgetMap = new Map(budgets.map((budget) => [budget.id, budget]));

    // Enrich statuses with budget details
    return rawStatuses
      .map((status): EnrichedBudgetStatus | null => {
        const budget = budgetMap.get(status.budget_id);
        if (!budget) {
          // If we can't find the budget, skip it
          return null;
        }

        // Calculate status based on percentage
        let budgetStatus: 'OK' | 'WARNING' | 'EXCEEDED';
        if (status.percentage_used >= 100) {
          budgetStatus = 'EXCEEDED';
        } else if (status.percentage_used >= 80) {
          budgetStatus = 'WARNING';
        } else {
          budgetStatus = 'OK';
        }

        // Extract period from filters if available, default to MONTHLY
        const period = (budget.filters as any)?.period?.toUpperCase() || 'MONTHLY';

        return {
          budget_id: status.budget_id,
          budget_name: budget.name,
          current_spending: status.current_spending,
          limit_amount: status.limit_amount,
          percentage: status.percentage_used,
          status: budgetStatus,
          period: period as BudgetPeriod,
          start_date: new Date().toISOString().split('T')[0], // Current date as placeholder
          end_date: undefined,
        };
      })
      .filter((status): status is EnrichedBudgetStatus => status !== null);
  }, [rawStatuses, budgets]);
}
