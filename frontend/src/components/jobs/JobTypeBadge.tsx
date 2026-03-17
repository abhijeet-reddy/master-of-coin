import { Badge } from '@chakra-ui/react';
import { JobType } from '@/types';

interface JobTypeBadgeProps {
  jobType: JobType;
}

const typeConfig: Record<JobType, { label: string; colorPalette: string }> = {
  [JobType.DRIFT_DETECTION]: { label: 'Drift Detection', colorPalette: 'purple' },
  [JobType.BULK_SYNC]: { label: 'Bulk Sync', colorPalette: 'cyan' },
  [JobType.PORTFOLIO_SYNC]: { label: 'Portfolio Sync', colorPalette: 'green' },
  [JobType.BANK_SYNC]: { label: 'Bank Sync', colorPalette: 'blue' },
};

export const JobTypeBadge = ({ jobType }: JobTypeBadgeProps) => {
  const config = typeConfig[jobType] ?? { label: jobType, colorPalette: 'purple' };

  return (
    <Badge variant="surface" colorPalette={config.colorPalette}>
      {config.label}
    </Badge>
  );
};
