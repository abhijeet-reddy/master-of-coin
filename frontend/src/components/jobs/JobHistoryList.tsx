import { useNavigate } from 'react-router-dom';
import { Card, Table, Text } from '@chakra-ui/react';
import { JobStatusBadge } from './JobStatusBadge';
import { JobTypeBadge } from './JobTypeBadge';
import { EmptyState } from '@/components/common';
import { formatRelativeTime } from '@/utils/formatters/date';
import { JobType } from '@/types';
import type { BackgroundJobSummary } from '@/types';

interface JobHistoryListProps {
  jobs: BackgroundJobSummary[];
}

const jobTypeToRoute: Record<JobType, string> = {
  [JobType.DRIFT_DETECTION]: 'drift-detection',
  [JobType.BULK_SYNC]: 'sync',
};

function extractSummaryText(job: BackgroundJobSummary): string {
  if (job.error) return `Error: ${job.error.slice(0, 50)}`;
  if (!job.summary) return '';

  const s = job.summary;
  if (job.job_type === JobType.DRIFT_DETECTION) {
    const synced = (s.synced as number) ?? 0;
    const drifted = (s.drifted as number) ?? 0;
    return `${synced} synced, ${drifted} drifted`;
  }
  if (job.job_type === JobType.BULK_SYNC) {
    const succeeded = (s.succeeded as number) ?? 0;
    const total = (s.total as number) ?? 0;
    return `${succeeded}/${total} ok`;
  }
  return '';
}

export const JobHistoryList = ({ jobs }: JobHistoryListProps) => {
  const navigate = useNavigate();

  if (jobs.length === 0) {
    return (
      <EmptyState title="No jobs yet" description="Run a drift detection from Settings > Split." />
    );
  }

  return (
    <Card.Root variant="elevated">
      <Card.Body p={0}>
        <Table.Root size="sm" interactive>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Type</Table.ColumnHeader>
              <Table.ColumnHeader>Status</Table.ColumnHeader>
              <Table.ColumnHeader>Created</Table.ColumnHeader>
              <Table.ColumnHeader>Summary</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {jobs.map((job) => {
              const routeType = jobTypeToRoute[job.job_type] ?? 'drift-detection';
              return (
                <Table.Row
                  key={job.id}
                  cursor="pointer"
                  onClick={() => void navigate(`/jobs/${routeType}/${job.id}`)}
                >
                  <Table.Cell>
                    <JobTypeBadge jobType={job.job_type} />
                  </Table.Cell>
                  <Table.Cell>
                    <JobStatusBadge status={job.status} />
                  </Table.Cell>
                  <Table.Cell>
                    <Text fontSize="sm" color="fg.muted">
                      {formatRelativeTime(job.created_at)}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text fontSize="sm" color="fg.muted" truncate>
                      {extractSummaryText(job)}
                    </Text>
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Root>
      </Card.Body>
    </Card.Root>
  );
};
