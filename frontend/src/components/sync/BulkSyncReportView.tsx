import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, HStack, SimpleGrid, Stat, Table, VStack } from '@chakra-ui/react';
import { SyncItemResultRow } from './SyncItemResultRow';
import { useRetryBulkSync } from '@/hooks/api/useBulkSync';
import type { BulkSyncReport } from '@/types';

interface BulkSyncReportViewProps {
  report: BulkSyncReport;
  jobId: string;
}

/**
 * Full bulk sync report view with Stat summary, Table for per-item results,
 * and a "Retry Failed" button when there are failed items.
 */
export const BulkSyncReportView = ({ report, jobId }: BulkSyncReportViewProps) => {
  const navigate = useNavigate();
  const retryBulkSync = useRetryBulkSync();

  const { summary, items } = report;
  const hasFailedItems = summary.failed > 0;

  const handleRetry = useCallback(() => {
    retryBulkSync.mutate(jobId, {
      onSuccess: (data) => {
        void navigate(`/jobs/sync/${data.job_id}`);
      },
    });
  }, [retryBulkSync, jobId, navigate]);

  return (
    <VStack gap={6} alignItems="stretch">
      {/* Summary stats */}
      <SimpleGrid columns={3} gap={4}>
        <Stat.Root borderWidth="1px" p="4" rounded="md">
          <Stat.Label>Total</Stat.Label>
          <Stat.ValueText>{summary.total}</Stat.ValueText>
        </Stat.Root>
        <Stat.Root borderWidth="1px" p="4" rounded="md">
          <Stat.Label>Succeeded</Stat.Label>
          <Stat.ValueText color="green.500">{summary.succeeded}</Stat.ValueText>
        </Stat.Root>
        <Stat.Root borderWidth="1px" p="4" rounded="md">
          <Stat.Label>Failed</Stat.Label>
          <Stat.ValueText color={hasFailedItems ? 'red.500' : 'fg.muted'}>
            {summary.failed}
          </Stat.ValueText>
        </Stat.Root>
      </SimpleGrid>

      {/* Per-item results table */}
      <Table.Root size="sm" variant="line">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>Action</Table.ColumnHeader>
            <Table.ColumnHeader>Item</Table.ColumnHeader>
            <Table.ColumnHeader>Detail</Table.ColumnHeader>
            <Table.ColumnHeader textAlign="end">Status</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {items.map((item, idx) => (
            <SyncItemResultRow key={idx} item={item} />
          ))}
        </Table.Body>
      </Table.Root>

      {/* Retry button */}
      {hasFailedItems && (
        <HStack justifyContent="flex-end">
          <Badge colorPalette="red" variant="subtle">
            {summary.failed} failed item{summary.failed !== 1 ? 's' : ''}
          </Badge>
          <Button
            colorPalette="blue"
            variant="outline"
            onClick={handleRetry}
            loading={retryBulkSync.isPending}
          >
            Retry Failed
          </Button>
        </HStack>
      )}
    </VStack>
  );
};
