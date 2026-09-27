import { Link } from 'react-router-dom';
import type { BackgroundJobSummary } from '@/api/types';
import { DateStyle } from '@/lib/format';
import { usePreferences } from '@/lib/preferences';
import { cx, Skeleton } from '@/ui';
import {
  durationMs,
  formatDuration,
  isJobActive,
  jobPath,
  jobSummaryText,
  jobTypeLabel,
} from '../lib/jobModel';
import { JobStatusBadge, ScheduleBadge } from './JobBadges';
import styles from './Jobs.module.css';

interface Props {
  jobs: readonly BackgroundJobSummary[];
  label?: string;
  /** Hide the schedule badge (on a schedule's own page every job has one). */
  hideSchedule?: boolean;
}

/** Job history rows: status, type, when, how long, and what came of it. */
export function JobList({ jobs, label = 'Jobs', hideSchedule = false }: Props) {
  const { fmt } = usePreferences();
  return (
    <ul className={styles.list} aria-label={label}>
      {jobs.map((job) => {
        const type = jobTypeLabel(job.job_type);
        const summary = jobSummaryText(job);
        const ms = isJobActive(job.status) ? null : durationMs(job.started_at, job.completed_at);
        return (
          <li key={job.id} className={styles.row} aria-label={`${type}, ${job.status}`}>
            <span>
              <JobStatusBadge status={job.status} />
            </span>
            <div className={styles.main}>
              <Link to={jobPath(job)} className={styles.title}>
                {type}
              </Link>
              <span className={styles.meta}>
                <span title={job.id}>#{job.id.slice(0, 8)}</span>
                {job.schedule_id && !hideSchedule ? (
                  <ScheduleBadge scheduleId={job.schedule_id} />
                ) : null}
              </span>
            </div>
            <span className={styles.when}>
              <span title={fmt.date(job.created_at, DateStyle.DateTime)}>
                {fmt.relative(job.created_at)}
              </span>
              <span className={styles.muted}>{fmt.date(job.created_at, DateStyle.DateTime)}</span>
            </span>
            <span className={styles.dur} aria-label={ms === null ? undefined : 'Duration'}>
              {ms === null ? '' : formatDuration(ms)}
            </span>
            <span className={cx(styles.summary, job.error && styles.summaryErr)} title={summary}>
              {summary}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function JobListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={styles.skelRow}>
          <Skeleton width={80} />
          <Skeleton width="50%" />
          <Skeleton width={100} />
        </div>
      ))}
    </>
  );
}
