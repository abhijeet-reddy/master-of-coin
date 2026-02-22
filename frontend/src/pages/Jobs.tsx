import { useState } from 'react';
import { Box, Portal, Select, createListCollection } from '@chakra-ui/react';
import { PageHeader, LoadingSpinner, ErrorAlert } from '@/components/common';
import { JobHistoryList } from '@/components/jobs';
import { useJobs } from '@/hooks/api/useJobs';
import { useDocumentTitle } from '@/hooks/effects';
import { JobType } from '@/types';

const jobTypeFilters = createListCollection({
  items: [
    { label: 'All Types', value: 'ALL' },
    { label: 'Drift Detection', value: JobType.DRIFT_DETECTION },
    { label: 'Bulk Sync', value: JobType.BULK_SYNC },
  ],
});

export const JobsPage = () => {
  useDocumentTitle('Jobs');
  const [filter, setFilter] = useState<string[]>(['ALL']);

  const filterValue = filter[0] ?? 'ALL';
  const jobTypeParam = filterValue === 'ALL' ? undefined : filterValue;
  const { data: jobs, isLoading, error } = useJobs({ job_type: jobTypeParam });

  if (isLoading) {
    return <LoadingSpinner message="Loading jobs..." />;
  }

  if (error) {
    return (
      <Box>
        <PageHeader title="Jobs" subtitle="View and manage background jobs" />
        <ErrorAlert title="Failed to load jobs" error={error} />
      </Box>
    );
  }

  const filterDropdown = (
    <Box w="220px">
      <Select.Root
        collection={jobTypeFilters}
        value={filter}
        onValueChange={(e) => setFilter(e.value)}
        size="sm"
      >
        <Select.HiddenSelect />
        <Select.Control>
          <Select.Trigger>
            <Select.ValueText placeholder="Filter by type" />
          </Select.Trigger>
          <Select.IndicatorGroup>
            <Select.Indicator />
          </Select.IndicatorGroup>
        </Select.Control>
        <Portal>
          <Select.Positioner>
            <Select.Content>
              {jobTypeFilters.items.map((item) => (
                <Select.Item item={item} key={item.value}>
                  {item.label}
                  <Select.ItemIndicator />
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Positioner>
        </Portal>
      </Select.Root>
    </Box>
  );

  return (
    <Box>
      <PageHeader
        title="Jobs"
        subtitle="View and manage background jobs"
        actions={filterDropdown}
      />

      <JobHistoryList jobs={jobs ?? []} />
    </Box>
  );
};
