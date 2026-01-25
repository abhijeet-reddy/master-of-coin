import { useState } from 'react';
import { Box, Button } from '@chakra-ui/react';
import { PageHeader, ConfirmDialog, ErrorAlert } from '@/components/common';
import { DebtSummary, PeopleList, PersonFormModal, SettleDebtModal } from '@/components/people';
import { useDocumentTitle, usePeople, useDeletePerson } from '@/hooks';
import type { Person } from '@/types';

export const People = () => {
  useDocumentTitle('People');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSettleOpen, setIsSettleOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Person | undefined>(undefined);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; person: Person | null }>({
    isOpen: false,
    person: null,
  });

  const { data: people = [], isLoading, error } = usePeople();
  const deleteMutation = useDeletePerson();

  // Query error state
  if (error) {
    return (
      <Box>
        <PageHeader title="People" />
        <ErrorAlert title="Failed to load people" error={error} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Delete Error Alert */}
      {deleteMutation.isError && deleteMutation.error && (
        <ErrorAlert title="Failed to delete person" error={deleteMutation.error} />
      )}

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
          setDeleteDialog({ isOpen: true, person });
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

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, person: null })}
        onConfirm={() => {
          if (deleteDialog.person) {
            deleteMutation.mutate(deleteDialog.person.id, {
              onSuccess: () => {
                setDeleteDialog({ isOpen: false, person: null });
              },
            });
          }
        }}
        title="Delete Person"
        message={`Are you sure you want to delete "${deleteDialog.person?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        colorScheme="red"
        isLoading={deleteMutation.isPending}
      />
    </Box>
  );
};
