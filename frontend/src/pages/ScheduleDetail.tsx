import { useParams } from 'react-router-dom';
import { Badge, Box, Card, HStack, SimpleGrid, Text, VStack } from '@chakra-ui/react';
import { PageHeader, LoadingSpinner, ErrorAlert } from '@/components/common';
import { JobHistoryList } from '@/components/jobs';
import { useSchedule } from '@/hooks/api/useSchedules';
import { useDocumentTitle } from '@/hooks/effects';

/** Format an ISO date string to a human-readable date/time */
const formatDateTime = (iso: string): string => {
  const date = new Date(iso);
  return date.toLocaleDateString('en-IE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const jobTypeLabels: Record<string, string> = {
  DRIFT_DETECTION: 'Drift Detection',
  BULK_SYNC: 'Bulk Sync',
};

export const ScheduleDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useSchedule(id ?? null);
  useDocumentTitle(data?.schedule.name ?? 'Schedule Detail');

  if (!id) {
    return (
      <Box>
        <PageHeader title="Schedule Not Found" />
        <ErrorAlert title="Invalid schedule" error={new Error('No schedule ID provided.')} />
      </Box>
    );
  }

  if (isLoading) {
    return <LoadingSpinner message="Loading schedule..." />;
  }

  if (error) {
    return (
      <Box>
        <PageHeader
          breadcrumbs={[{ label: 'Schedules', href: '/schedules' }, { label: 'Error' }]}
        />
        <ErrorAlert title="Failed to load schedule" error={error} />
      </Box>
    );
  }

  if (!data) {
    return (
      <Box>
        <PageHeader
          breadcrumbs={[{ label: 'Schedules', href: '/schedules' }, { label: 'Not Found' }]}
        />
        <ErrorAlert title="Schedule not found" error={new Error('Schedule data is unavailable.')} />
      </Box>
    );
  }

  const { schedule, recent_jobs, upcoming_runs } = data;

  return (
    <Box>
      <PageHeader
        breadcrumbs={[{ label: 'Schedules', href: '/schedules' }, { label: schedule.name }]}
      />

      <VStack gap={6} alignItems="stretch">
        {/* Schedule Info Card */}
        <Card.Root variant="elevated">
          <Card.Body p={5}>
            <VStack gap={4} alignItems="stretch">
              <HStack justifyContent="space-between" alignItems="center">
                <Text fontSize="lg" fontWeight="semibold">
                  {schedule.name}
                </Text>
                <Badge variant="surface" colorPalette={schedule.is_active ? 'green' : 'gray'}>
                  {schedule.is_active ? 'Active' : 'Paused'}
                </Badge>
              </HStack>

              <SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
                <VStack alignItems="flex-start" gap={0}>
                  <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                    Job Type
                  </Text>
                  <Text fontSize="sm">{jobTypeLabels[schedule.job_type] ?? schedule.job_type}</Text>
                </VStack>
                <VStack alignItems="flex-start" gap={0}>
                  <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                    Frequency
                  </Text>
                  <Text fontSize="sm">{schedule.cron_description}</Text>
                </VStack>
                {schedule.next_run_at && (
                  <VStack alignItems="flex-start" gap={0}>
                    <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                      Next Run
                    </Text>
                    <Text fontSize="sm">{formatDateTime(schedule.next_run_at)}</Text>
                  </VStack>
                )}
                {schedule.last_run_at && (
                  <VStack alignItems="flex-start" gap={0}>
                    <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                      Last Run
                    </Text>
                    <Text fontSize="sm">{formatDateTime(schedule.last_run_at)}</Text>
                  </VStack>
                )}
              </SimpleGrid>

              {schedule.parameters && Object.keys(schedule.parameters).length > 0 && (
                <VStack alignItems="flex-start" gap={1}>
                  <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                    Parameters
                  </Text>
                  <Text fontSize="sm" fontFamily="mono">
                    {JSON.stringify(schedule.parameters, null, 2)}
                  </Text>
                </VStack>
              )}

              <VStack alignItems="flex-start" gap={0}>
                <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                  Cron Expression
                </Text>
                <Text fontSize="sm" fontFamily="mono">
                  {schedule.cron_expr}
                </Text>
              </VStack>
            </VStack>
          </Card.Body>
        </Card.Root>

        {/* Upcoming Runs */}
        {upcoming_runs.length > 0 && (
          <Card.Root variant="elevated">
            <Card.Header>
              <Text fontWeight="semibold">Upcoming Runs</Text>
            </Card.Header>
            <Card.Body pt={0}>
              <VStack gap={2} alignItems="stretch">
                {upcoming_runs.map((run, index) => (
                  <HStack key={index} gap={3}>
                    <Badge variant="outline" colorPalette="blue" size="sm">
                      {index + 1}
                    </Badge>
                    <Text fontSize="sm">{formatDateTime(run)}</Text>
                  </HStack>
                ))}
              </VStack>
            </Card.Body>
          </Card.Root>
        )}

        {/* Previous Runs */}
        <VStack gap={2} alignItems="stretch">
          <Text fontWeight="semibold" fontSize="md">
            Previous Runs
          </Text>
          <JobHistoryList
            jobs={recent_jobs}
            emptyTitle="No jobs triggered yet"
            emptyDescription="This schedule will create jobs automatically at the scheduled times."
          />
        </VStack>
      </VStack>
    </Box>
  );
};
