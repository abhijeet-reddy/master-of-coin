import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Card, HStack, IconButton, Switch, Text, VStack } from '@chakra-ui/react';
import { MdDelete } from 'react-icons/md';
import { useUpdateSchedule } from '@/hooks/api/useSchedules';
import { formatRelativeTime } from '@/utils/formatters/date';
import type { Schedule } from '@/types';

interface ScheduleCardProps {
  schedule: Schedule;
  onDelete: (id: string) => void;
}

const jobTypeConfig: Record<string, { label: string; colorPalette: string }> = {
  DRIFT_DETECTION: { label: 'Drift Detection', colorPalette: 'purple' },
  BULK_SYNC: { label: 'Bulk Sync', colorPalette: 'cyan' },
};

export const ScheduleCard = ({ schedule, onDelete }: ScheduleCardProps) => {
  const navigate = useNavigate();
  const updateSchedule = useUpdateSchedule();

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      updateSchedule.mutate({
        id: schedule.id,
        request: { is_active: !schedule.is_active },
      });
    },
    [updateSchedule, schedule.id, schedule.is_active]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete(schedule.id);
    },
    [onDelete, schedule.id]
  );

  const typeConfig = jobTypeConfig[schedule.job_type] ?? {
    label: schedule.job_type,
    colorPalette: 'gray',
  };

  return (
    <Card.Root
      variant="elevated"
      cursor="pointer"
      onClick={() => void navigate(`/schedules/${schedule.id}`)}
      _hover={{ shadow: 'md' }}
    >
      <Card.Body p={4}>
        <VStack gap={3} alignItems="stretch">
          {/* Row 1: Name + Actions */}
          <HStack justifyContent="space-between" alignItems="center">
            <Text fontWeight="semibold" fontSize="sm" truncate>
              {schedule.name}
            </Text>
            <HStack gap={2} flexShrink={0}>
              <Switch.Root
                size="sm"
                checked={schedule.is_active}
                onCheckedChange={() => undefined}
                onClick={handleToggle}
              >
                <Switch.HiddenInput />
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Root>
              <IconButton
                aria-label="Delete schedule"
                size="xs"
                variant="ghost"
                colorPalette="red"
                onClick={handleDelete}
              >
                <MdDelete />
              </IconButton>
            </HStack>
          </HStack>

          {/* Row 2: Badges + Cron */}
          <HStack gap={2} flexWrap="wrap">
            <Badge variant="surface" colorPalette={typeConfig.colorPalette} size="sm">
              {typeConfig.label}
            </Badge>
            <Text fontSize="xs" color="fg.muted">
              {schedule.cron_description}
            </Text>
          </HStack>

          {/* Row 3: Timing info */}
          <HStack gap={4} fontSize="xs" color="fg.muted">
            {schedule.next_run_at && <Text>Next: {formatRelativeTime(schedule.next_run_at)}</Text>}
            {schedule.last_run_at && <Text>Last: {formatRelativeTime(schedule.last_run_at)}</Text>}
            {!schedule.is_active && (
              <Badge variant="subtle" colorPalette="gray" size="sm">
                Paused
              </Badge>
            )}
          </HStack>
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};
