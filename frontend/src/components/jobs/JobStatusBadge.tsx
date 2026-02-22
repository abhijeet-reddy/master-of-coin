import { Status } from '@chakra-ui/react';
import { JobStatus } from '@/types';

interface JobStatusBadgeProps {
  status: JobStatus;
}

const statusConfig: Record<JobStatus, { colorPalette: string; label: string }> = {
  [JobStatus.PENDING]: { colorPalette: 'gray', label: 'Pending' },
  [JobStatus.RUNNING]: { colorPalette: 'blue', label: 'Running' },
  [JobStatus.COMPLETED]: { colorPalette: 'green', label: 'Completed' },
  [JobStatus.FAILED]: { colorPalette: 'red', label: 'Failed' },
};

export const JobStatusBadge = ({ status }: JobStatusBadgeProps) => {
  const config = statusConfig[status] ?? { colorPalette: 'gray', label: status };

  return (
    <Status.Root colorPalette={config.colorPalette}>
      <Status.Indicator />
      {config.label}
    </Status.Root>
  );
};
