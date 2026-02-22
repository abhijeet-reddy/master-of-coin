import { useCallback, useState } from 'react';
import { Box, Button, SimpleGrid } from '@chakra-ui/react';
import { MdSchedule } from 'react-icons/md';
import {
  PageHeader,
  LoadingSpinner,
  ErrorAlert,
  EmptyState,
  ConfirmDialog,
} from '@/components/common';
import { ScheduleCard, CreateScheduleModal } from '@/components/schedules';
import { useSchedules, useDeleteSchedule } from '@/hooks/api/useSchedules';
import { useDocumentTitle } from '@/hooks/effects';

export const SchedulesPage = () => {
  useDocumentTitle('Schedules');
  const { data: schedules, isLoading, error } = useSchedules();
  const deleteSchedule = useDeleteSchedule();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = useCallback((id: string) => {
    setDeleteId(id);
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteId) {
      deleteSchedule.mutate(deleteId);
      setDeleteId(null);
    }
  }, [deleteId, deleteSchedule]);

  if (isLoading) {
    return <LoadingSpinner message="Loading schedules..." />;
  }

  if (error) {
    return (
      <Box>
        <PageHeader title="Schedules" subtitle="Manage automated job schedules" />
        <ErrorAlert title="Failed to load schedules" error={error} />
      </Box>
    );
  }

  const createButton = (
    <Button colorPalette="blue" size="sm" onClick={() => setIsCreateOpen(true)}>
      Create Schedule
    </Button>
  );

  return (
    <Box>
      <PageHeader
        title="Schedules"
        subtitle="Manage automated job schedules"
        actions={createButton}
      />

      {schedules && schedules.length > 0 ? (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
          {schedules.map((schedule) => (
            <ScheduleCard key={schedule.id} schedule={schedule} onDelete={handleDelete} />
          ))}
        </SimpleGrid>
      ) : (
        <EmptyState
          icon={<MdSchedule />}
          title="No schedules yet"
          description="Create a schedule to automatically run jobs on a recurring basis."
          actionLabel="Create Schedule"
          onAction={() => setIsCreateOpen(true)}
        />
      )}

      <CreateScheduleModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="Delete Schedule"
        message="Are you sure you want to delete this schedule? Jobs already created by this schedule will not be affected."
        confirmText="Delete"
        colorScheme="red"
        isLoading={deleteSchedule.isPending}
      />
    </Box>
  );
};
