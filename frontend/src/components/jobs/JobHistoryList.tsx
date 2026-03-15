import { useNavigate } from 'react-router-dom';
import { Badge, Card, HStack, Table, Text } from '@chakra-ui/react';
import { JobStatusBadge } from './JobStatusBadge';
import { JobTypeBadge } from './JobTypeBadge';
import { EmptyState } from '@/components/common';
import { formatRelativeTime } from '@/utils/formatters/date';
import { JobType } from '@/types';
import type { BackgroundJobSummary } from '@/types';

interface JobHistoryListProps {
  jobs: BackgroundJobSummary[];
  /** Override the default empty-state title */
  emptyTitle?: string;
  /** Override the default empty-state description */
  emptyDescription?: string;
}

const jobTypeToRoute: Record<JobType, string> = {
  [JobType.DRIFT_DETECTION]: 'drift-detection',
  [JobType.BULK_SYNC]: 'sync',
  [JobType.PORTFOLIO_SYNC]: 'portfolio-sync',
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

/**
 * Extract schedule_id from job summary if present.
 * Note: schedule_id is stored in the job's `input` JSONB, not `summary`.
 * This check is best-effort — the backend would need to include schedule_id
 * in the summary or expose the input field for full support.
 */
function extractScheduleId(job: BackgroundJobSummary): string | null {
  const s = job.summary;
  if (s && typeof s.schedule_id === 'string') return s.schedule_id;
  return null;
}

export const JobHistoryList = ({ jobs, emptyTitle, emptyDescription }: JobHistoryListProps) => {
  const navigate = useNavigate();

  if (jobs.length === 0) {
    return (
      <EmptyState
        title={emptyTitle ?? 'No jobs yet'}
        description={emptyDescription ?? 'Run a drift detection from Settings > Split.'}
      />
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
                    <HStack gap={2}>
                      <JobTypeBadge jobType={job.job_type} />
                      {extractScheduleId(job) && (
                        <Badge
                          variant="outline"
                          colorPalette="teal"
                          size="sm"
                          cursor="pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            void navigate(`/schedules/${extractScheduleId(job)}`);
                          }}
                        >
                          Scheduled
                        </Badge>
                      )}
                    </HStack>
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
