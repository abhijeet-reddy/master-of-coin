import { useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { Box, Button, HStack, Text, VStack } from '@chakra-ui/react';
import { MdArrowBack } from 'react-icons/md';
import { PageHeader, LoadingSpinner, ErrorAlert } from '@/components/common';
import { JobProgressCard, JobStatusBadge } from '@/components/jobs';
import { DriftReportView } from '@/components/drift';
import { BulkSyncReportView } from '@/components/sync';
import { useDriftJob, useRetryDriftJob } from '@/hooks/api/useDriftDetection';
import { useBulkSyncJob, useRetryBulkSync } from '@/hooks/api/useBulkSync';
import { useDocumentTitle } from '@/hooks/effects';
import { JobStatus } from '@/types';

type JobDetailType = 'drift-detection' | 'sync';

const DriftJobDetail = ({ id }: { id: string }) => {
  const navigate = useNavigate();
  const { data: job, isLoading, error } = useDriftJob(id);
  const retryDriftJob = useRetryDriftJob();

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
    return <JobProgressCard status={job.status} />;
  }

  if (job.status === JobStatus.FAILED) {
    return (
      <VStack gap={4} alignItems="stretch">
        <ErrorAlert
          title="Drift detection failed"
          error={new Error(job.error ?? 'Unknown error')}
        />
        <Box>
          <Button
            colorPalette="blue"
            variant="outline"
            onClick={handleRetry}
            loading={retryDriftJob.isPending}
          >
            Retry
          </Button>
        </Box>
      </VStack>
    );
  }

  if (job.status === JobStatus.COMPLETED && job.result) {
    return <DriftReportView report={job.result} />;
  }

  return (
    <ErrorAlert title="Unexpected state" error={new Error('Job is in an unexpected state.')} />
  );
};

const SyncJobDetail = ({ id }: { id: string }) => {
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
    return <JobProgressCard status={job.status} />;
  }

  if (job.status === JobStatus.FAILED) {
    return (
      <VStack gap={4} alignItems="stretch">
        <ErrorAlert title="Bulk sync failed" error={new Error(job.error ?? 'Unknown error')} />
        <Box>
          <Button
            colorPalette="blue"
            variant="outline"
            onClick={handleRetry}
            loading={retryBulkSync.isPending}
          >
            Retry
          </Button>
        </Box>
      </VStack>
    );
  }

  if (job.status === JobStatus.COMPLETED && job.result) {
    return <BulkSyncReportView report={job.result} jobId={id} />;
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
      <PageHeader
        breadcrumbs={[{ label: 'Jobs', href: '/jobs' }, { label: pageTitle }]}
        actions={
          <HStack gap={2}>
            <JobStatusBadgeForJob type={jobType} id={id} />
          </HStack>
        }
      />

      <HStack mb={4}>
        <RouterLink to="/jobs" style={{ textDecoration: 'none' }}>
          <Button variant="ghost" size="sm">
            <MdArrowBack />
            <Text ml={1}>Back to Jobs</Text>
          </Button>
        </RouterLink>
      </HStack>

      {!isValidType ? (
        <ErrorAlert
          title="Unknown job type"
          error={new Error(`Job type "${type}" is not recognized.`)}
        />
      ) : jobType === 'drift-detection' ? (
        <DriftJobDetail id={id} />
      ) : (
        <SyncJobDetail id={id} />
      )}
    </Box>
  );
};

/** Small helper to show status badge in the header */
const JobStatusBadgeForJob = ({ type, id }: { type: JobDetailType; id: string }) => {
  const driftJob = useDriftJob(type === 'drift-detection' ? id : null);
  const syncJob = useBulkSyncJob(type === 'sync' ? id : null);

  const status = type === 'drift-detection' ? driftJob.data?.status : syncJob.data?.status;

  if (!status) return null;
  return <JobStatusBadge status={status} />;
};
