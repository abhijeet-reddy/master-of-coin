import type { ReactNode } from 'react';
import { CalendarClock, CircleCheck, CircleX, Clock, LoaderCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { JobStatus } from '@/api/types';
import { Badge } from '@/ui';
import { jobStatus } from '../lib/jobModel';
import styles from './Jobs.module.css';

const ICON: Record<JobStatus, ReactNode> = {
  [JobStatus.PENDING]: <Clock aria-hidden size={12} />,
  [JobStatus.RUNNING]: <LoaderCircle aria-hidden size={12} className={styles.spin} />,
  [JobStatus.COMPLETED]: <CircleCheck aria-hidden size={12} />,
  [JobStatus.FAILED]: <CircleX aria-hidden size={12} />,
};

export function JobStatusBadge({ status }: { status: string }) {
  const s = jobStatus(status);
  return (
    <Badge tone={s.tone} icon={ICON[status as JobStatus]}>
      {s.label}
    </Badge>
  );
}

/** "Scheduled", linking to the schedule that started the job. */
export function ScheduleBadge({ scheduleId }: { scheduleId: string }) {
  return (
    <Link
      to={`/schedules/${scheduleId}`}
      className={styles.schedLink}
      aria-label="Scheduled, open its schedule"
    >
      <CalendarClock aria-hidden />
      Scheduled
    </Link>
  );
}
