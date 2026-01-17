import { useState } from 'react';
import { Box, Button } from '@chakra-ui/react';
import { PageHeader } from '@/components/common';
import { DebtSummary, PeopleList, PersonFormModal, SettleDebtModal } from '@/components/people';
import { useDocumentTitle, usePeople, useDeletePerson } from '@/hooks';
import type { Person } from '@/types';

export const People = () => {
  useDocumentTitle('People');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSettleOpen, setIsSettleOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Person | undefined>(undefined);

  const { data: people = [], isLoading, error } = usePeople();
  const { mutate: deletePerson } = useDeletePerson();

  // Error state
  if (error) {
    return (
      <Box>
        <PageHeader title="People" />
        <Box bg="red.50" p={6} borderRadius="lg" border="1px solid" borderColor="red.200">
          <Box color="red.800" fontWeight="semibold" mb={2}>
            Error loading people
          </Box>
          <Box color="red.600" fontSize="sm">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="People"
        subtitle="Track shared expenses and debts"
        actions={
          <Button
            colorScheme="blue"
            onClick={() => {
              setSelectedPerson(undefined);
              setIsFormOpen(true);
            }}
          >
            Add Person
          </Button>
        }
      />

      {/* Debt Summary Card */}
      {!isLoading && people.length > 0 && <DebtSummary people={people} />}

      {/* People List */}
      <PeopleList
        people={people}
        isLoading={isLoading}
        onEdit={(person) => {
          setSelectedPerson(person);
          setIsFormOpen(true);
        }}
        onDelete={(person) => {
          if (confirm(`Are you sure you want to delete "${person.name}"?`)) {
            deletePerson(person.id);
          }
        }}
        onSettle={(person) => {
          setSelectedPerson(person);
          setIsSettleOpen(true);
        }}
      />

      {/* Person Form Modal */}
      <PersonFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedPerson(undefined);
        }}
        person={selectedPerson}
        onSuccess={() => {
          setIsFormOpen(false);
          setSelectedPerson(undefined);
        }}
      />

      {/* Settle Debt Modal */}
      {selectedPerson && (
        <SettleDebtModal
          isOpen={isSettleOpen}
          onClose={() => {
            setIsSettleOpen(false);
            setSelectedPerson(undefined);
          }}
          person={selectedPerson}
          debtAmount={parseFloat(selectedPerson.debt_summary?.net || '0')}
          onSuccess={() => {
            setIsSettleOpen(false);
            setSelectedPerson(undefined);
          }}
        />
      )}
    </Box>
  );
};
