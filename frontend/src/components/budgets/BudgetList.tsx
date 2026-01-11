import { SimpleGrid, Skeleton } from '@chakra-ui/react';
import { EmptyState } from '@/components/common';
import { BudgetCard } from './BudgetCard';
import type { EnrichedBudgetStatus } from '@/types';

interface BudgetListProps {
  budgets: EnrichedBudgetStatus[];
  isLoading?: boolean;
  onEdit: (budget: EnrichedBudgetStatus) => void;
  onDelete: (budget: EnrichedBudgetStatus) => void;
}

export const BudgetList = ({ budgets, isLoading, onEdit, onDelete }: BudgetListProps) => {
  // Loading state
  if (isLoading) {
    return (
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={6}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} height="300px" borderRadius="lg" />
        ))}
      </SimpleGrid>
    );
  }

  // Empty state
  if (budgets.length === 0) {
    return (
      <EmptyState
        title="No budgets yet"
        description="Create your first budget to start tracking your spending goals"
      />
    );
  }

  // Sort budgets: EXCEEDED first, then WARNING, then OK
  const sortedBudgets = [...budgets].sort((a, b) => {
    const statusOrder = { EXCEEDED: 0, WARNING: 1, OK: 2 };
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;
    // If same status, sort by name
    return a.budget_name.localeCompare(b.budget_name);
  });

  return (
    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={6}>
      {sortedBudgets.map((budget) => (
        <BudgetCard
          key={budget.budget_id}
          budget={budget}
          onEdit={() => onEdit(budget)}
          onDelete={() => onDelete(budget)}
        />
      ))}
    </SimpleGrid>
  );
};
