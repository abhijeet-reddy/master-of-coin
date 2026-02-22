import { useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, Card, HStack, SimpleGrid, Text, VStack } from '@chakra-ui/react';
import { PageHeader, LoadingSpinner, ErrorAlert } from '@/components/common';
import { JobProgressCard, JobStatusBadge } from '@/components/jobs';
import { DriftReportView } from '@/components/drift';
import { BulkSyncReportView } from '@/components/sync';
import { SyncWizard } from '@/components/sync/wizard';
import { useDriftJob, useRetryDriftJob } from '@/hooks/api/useDriftDetection';
import { useBulkSyncJob, useRetryBulkSync } from '@/hooks/api/useBulkSync';
import { useDocumentTitle } from '@/hooks/effects';
import { JobStatus } from '@/types';
import type { DriftReport } from '@/types';

type JobDetailType = 'drift-detection' | 'sync';

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

/** Calculate duration between two ISO date strings */
const formatDuration = (start: string, end: string): string => {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = (seconds % 60).toFixed(0);
  return `${minutes}m ${remainingSeconds}s`;
};

/** Job header card showing title, status, timestamps, and action buttons */
const JobHeaderCard = ({
  title,
  status,
  createdAt,
  startedAt,
  completedAt,
  actions,
}: {
  title: string;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  actions?: React.ReactNode;
}) => {
  const duration = startedAt && completedAt ? formatDuration(startedAt, completedAt) : undefined;

  return (
    <Card.Root variant="elevated">
      <Card.Body p={5}>
        <VStack alignItems="stretch" gap={4}>
          {/* Row 1: Title + Status & Actions */}
          <HStack justifyContent="space-between" alignItems="center">
            <Text fontSize="lg" fontWeight="semibold">
              {title}
            </Text>
            <HStack gap={3} flexShrink={0}>
              <JobStatusBadge status={status} />
              {actions}
            </HStack>
          </HStack>

          {/* Row 2: Timestamps in a grid */}
          <SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
            <VStack alignItems="flex-start" gap={0}>
              <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                Created
              </Text>
              <Text fontSize="sm">{formatDateTime(createdAt)}</Text>
            </VStack>
            {startedAt && (
              <VStack alignItems="flex-start" gap={0}>
                <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                  Started
                </Text>
                <Text fontSize="sm">{formatDateTime(startedAt)}</Text>
              </VStack>
            )}
            {completedAt && (
              <VStack alignItems="flex-start" gap={0}>
                <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                  Completed
                </Text>
                <Text fontSize="sm">{formatDateTime(completedAt)}</Text>
              </VStack>
            )}
            {duration && (
              <VStack alignItems="flex-start" gap={0}>
                <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                  Duration
                </Text>
                <Text fontSize="sm">{duration}</Text>
              </VStack>
            )}
          </SimpleGrid>
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};

const DriftJobDetail = ({ id, pageTitle }: { id: string; pageTitle: string }) => {
  const navigate = useNavigate();
  const { data: job, isLoading, error } = useDriftJob(id);
  const retryDriftJob = useRetryDriftJob();
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const handleRetry = useCallback(() => {
    retryDriftJob.mutate(id, {
      onSuccess: (data) => {
        void navigate(`/jobs/drift-detection/${data.job_id}`);
      },
    });
  }, [retryDriftJob, id, navigate]);

  if (isLoading) return <LoadingSpinner message="Loading drift detection job..." />;
  if (error) return <ErrorAlert title="Failed to load job" error={error} />;
  if (!job)
    return <ErrorAlert title="Job not found" error={new Error('Job data is unavailable.')} />;

  if (job.status === JobStatus.PENDING || job.status === JobStatus.RUNNING) {
    return (
      <VStack gap={4} alignItems="stretch">
        <JobHeaderCard
          title={pageTitle}
          status={job.status}
          createdAt={job.created_at}
          startedAt={job.started_at}
        />
        <JobProgressCard status={job.status} />
      </VStack>
    );
  }

  if (job.status === JobStatus.FAILED) {
    return (
      <VStack gap={4} alignItems="stretch">
        <JobHeaderCard
          title={pageTitle}
          status={job.status}
          createdAt={job.created_at}
          startedAt={job.started_at}
          completedAt={job.completed_at}
          actions={
            <Button
              colorPalette="blue"
              variant="outline"
              size="sm"
              onClick={handleRetry}
              loading={retryDriftJob.isPending}
            >
              Retry
            </Button>
          }
        />
        <ErrorAlert
          title="Drift detection failed"
          error={new Error(job.error ?? 'Unknown error')}
        />
      </VStack>
    );
  }

  if (job.status === JobStatus.COMPLETED && job.result) {
    const report: DriftReport = job.result;
    const hasSyncableItems =
      report.drifted.length > 0 ||
      report.missing_on_external.length > 0 ||
      report.missing_on_local.length > 0;

    return (
      <VStack gap={4} alignItems="stretch">
        <JobHeaderCard
          title={pageTitle}
          status={job.status}
          createdAt={job.created_at}
          startedAt={job.started_at}
          completedAt={job.completed_at}
          actions={
            <Button
              colorPalette="blue"
              size="sm"
              disabled={!hasSyncableItems}
              onClick={() => setIsWizardOpen(true)}
            >
              Sync
            </Button>
          }
        />
        <DriftReportView report={report} />
        <SyncWizard isOpen={isWizardOpen} onClose={() => setIsWizardOpen(false)} report={report} />
      </VStack>
    );
  }

  return (
    <ErrorAlert title="Unexpected state" error={new Error('Job is in an unexpected state.')} />
  );
};

const SyncJobDetail = ({ id, pageTitle }: { id: string; pageTitle: string }) => {
  const { data: job, isLoading, error } = useBulkSyncJob(id);
  const navigate = useNavigate();
  const retryBulkSync = useRetryBulkSync();

  const handleRetry = useCallback(() => {
    retryBulkSync.mutate(id, {
      onSuccess: (data) => {
        void navigate(`/jobs/sync/${data.job_id}`);
      },
    });
  }, [retryBulkSync, id, navigate]);

  if (isLoading) return <LoadingSpinner message="Loading sync job..." />;
  if (error) return <ErrorAlert title="Failed to load job" error={error} />;
  if (!job)
    return <ErrorAlert title="Job not found" error={new Error('Job data is unavailable.')} />;

  if (job.status === JobStatus.PENDING || job.status === JobStatus.RUNNING) {
    return (
      <VStack gap={4} alignItems="stretch">
        <JobHeaderCard
          title={pageTitle}
          status={job.status}
          createdAt={job.created_at}
          startedAt={job.started_at}
        />
        <JobProgressCard status={job.status} />
      </VStack>
    );
  }

  if (job.status === JobStatus.FAILED) {
    return (
      <VStack gap={4} alignItems="stretch">
        <JobHeaderCard
          title={pageTitle}
          status={job.status}
          createdAt={job.created_at}
          startedAt={job.started_at}
          completedAt={job.completed_at}
          actions={
            <Button
              colorPalette="blue"
              variant="outline"
              size="sm"
              onClick={handleRetry}
              loading={retryBulkSync.isPending}
            >
              Retry
            </Button>
          }
        />
        <ErrorAlert title="Bulk sync failed" error={new Error(job.error ?? 'Unknown error')} />
      </VStack>
    );
  }

  if (job.status === JobStatus.COMPLETED && job.result) {
    return (
      <VStack gap={4} alignItems="stretch">
        <JobHeaderCard
          title={pageTitle}
          status={job.status}
          createdAt={job.created_at}
          startedAt={job.started_at}
          completedAt={job.completed_at}
        />
        <BulkSyncReportView report={job.result} jobId={id} />
      </VStack>
    );
  }

  return (
    <ErrorAlert title="Unexpected state" error={new Error('Job is in an unexpected state.')} />
  );
};

const titleMap: Record<JobDetailType, string> = {
  'drift-detection': 'Drift Detection',
  sync: 'Bulk Sync',
};

export const JobDetailPage = () => {
  const { type, id } = useParams<{ type: string; id: string }>();
  const jobType = type as JobDetailType;
  const pageTitle = titleMap[jobType] ?? 'Job Detail';

  useDocumentTitle(pageTitle);

  if (!id) {
    return (
      <Box>
        <PageHeader title="Job Not Found" />
        <ErrorAlert title="Invalid job" error={new Error('No job ID provided.')} />
      </Box>
    );
  }

  const isValidType = jobType === 'drift-detection' || jobType === 'sync';

  return (
    <Box>
      <PageHeader breadcrumbs={[{ label: 'Jobs', href: '/jobs' }, { label: pageTitle }]} />

      {!isValidType ? (
        <ErrorAlert
          title="Unknown job type"
          error={new Error(`Job type "${type}" is not recognized.`)}
        />
      ) : jobType === 'drift-detection' ? (
        <DriftJobDetail id={id} pageTitle={pageTitle} />
      ) : (
        <SyncJobDetail id={id} pageTitle={pageTitle} />
      )}
    </Box>
  );
};
