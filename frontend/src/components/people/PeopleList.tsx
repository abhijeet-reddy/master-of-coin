import { useMemo } from 'react';
import { VStack, Skeleton } from '@chakra-ui/react';
import { EmptyState } from '@/components/common';
import { PersonCard } from './PersonCard';
import { useTransactions, usePersonDebts } from '@/hooks';
import type { Person } from '@/types';

interface PeopleListProps {
  people: Person[];
  isLoading?: boolean;
  onEdit: (person: Person) => void;
  onDelete: (person: Person) => void;
  onSettle: (person: Person) => void;
}

export const PeopleList = ({ people, isLoading, onEdit, onDelete, onSettle }: PeopleListProps) => {
  const { data: transactionsResponse } = useTransactions();
  const transactions = transactionsResponse?.data || [];
  const personDebts = usePersonDebts(people, transactions);

  // Enrich people with debt summaries
  const enrichedPeople = useMemo(() => {
    return people.map((person) => ({
      ...person,
      debt_summary: personDebts.get(person.id),
    }));
  }, [people, personDebts]);
  // Loading state
  if (isLoading) {
    return (
      <VStack align="stretch" gap={4}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} height="200px" borderRadius="lg" />
        ))}
      </VStack>
    );
  }

  // Empty state
  if (people.length === 0) {
    return (
      <EmptyState
        title="No people yet"
        description="Add people to track shared expenses and debts"
      />
    );
  }

  // Sort people by debt amount (highest first)
  const sortedPeople = [...enrichedPeople].sort((a, b) => {
    const aNet = Math.abs(parseFloat(a.debt_summary?.net || '0'));
    const bNet = Math.abs(parseFloat(b.debt_summary?.net || '0'));
    return bNet - aNet;
  });

  return (
    <VStack align="stretch" gap={4}>
      {sortedPeople.map((person) => (
        <PersonCard
          key={person.id}
          person={person}
          onEdit={() => onEdit(person)}
          onDelete={() => onDelete(person)}
          onSettle={() => onSettle(person)}
        />
      ))}
    </VStack>
  );
};
