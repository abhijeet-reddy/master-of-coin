import { Pause, Pencil, Play, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageActions } from '@/app/shell/PageActions';
import { useSetPageMeta } from '@/app/shell/routeMeta';
import { toApiError } from '@/api/client';
import type { ScheduleDetailResponse } from '@/api/types';
import { JobList, jobTypeLabel } from '@/features/jobs';
import { DateStyle } from '@/lib/format';
import { usePreferences } from '@/lib/preferences';
import {
  Badge,
  Button,
  buttonClass,
  ButtonVariant,
  ControlSize,
  EmptyState,
  ErrorState,
  Panel,
  Skeleton,
  Stat,
  StatGroup,
  Tone,
} from '@/ui';
import { useScheduleDialogs } from '../components/useScheduleDialogs';
import {
  useBankOptions,
  useRunScheduleNow,
  useSchedule,
  useToggleSchedule,
} from '../hooks/useScheduleQueries';
import { cronLabel, parameterLines, timeUntil } from '../lib/cron';
import styles from '../components/Schedules.module.css';

const CRUMBS = [{ label: 'Schedules', to: '/schedules' }];

/** `/schedules/:id`: when it runs, with what, the next runs and the jobs it started. */
export function ScheduleDetailPage() {
  const { id = '' } = useParams();
  const q = useSchedule(id);
  useSetPageMeta(q.data?.schedule.name, CRUMBS);

  if (q.error && !q.data)
    return (
      <div className={styles.page}>
        <Panel>
          {toApiError(q.error).status === 404 ? (
            <EmptyState
              title="Schedule not found"
              description="It may have been deleted."
              action={
                <Link
                  to="/schedules"
                  className={buttonClass(ButtonVariant.Secondary, ControlSize.Md)}
                >
                  Back to schedules
                </Link>
              }
            />
          ) : (
            <ErrorState
              error={q.error}
              title="Could not load this schedule"
              onRetry={() => void q.refetch()}
            />
          )}
        </Panel>
      </div>
    );
  if (!q.data) return <DetailSkeleton />;
  return <ScheduleDetail data={q.data} />;
}

function ScheduleDetail({ data }: { data: ScheduleDetailResponse }) {
  const { schedule: s, recent_jobs: jobs, upcoming_runs: upcoming } = data;
  const { fmt } = usePreferences();
  const navigate = useNavigate();
  const toggle = useToggleSchedule();
  const run = useRunScheduleNow();
  const banks = useBankOptions();
  const d = useScheduleDialogs(() => void navigate('/schedules'));
  const at = (v?: string) => (v ? fmt.date(v, DateStyle.DateTime) : 'Never');
  const params = parameterLines(s.job_type, s.parameters, banks.nameOf);

  return (
    <div className={styles.page}>
      <PageActions>
        <Button
          variant={ButtonVariant.Primary}
          icon={<Play aria-hidden />}
          loading={run.isPending}
          onClick={() => run.mutate(s)}
        >
          Run now
        </Button>
        <Button
          icon={s.is_active ? <Pause aria-hidden /> : <Play aria-hidden />}
          loading={toggle.isPending}
          onClick={() => toggle.mutate(s)}
        >
          {s.is_active ? 'Pause' : 'Resume'}
        </Button>
        <Button icon={<Pencil aria-hidden />} onClick={() => d.openEdit(s)}>
          Edit
        </Button>
        <Button icon={<Trash2 aria-hidden />} onClick={() => d.confirmDelete(s)}>
          Delete
        </Button>
      </PageActions>

      <div className={styles.head}>
        <Badge tone={s.is_active ? Tone.Pos : Tone.Warn}>{s.is_active ? 'Active' : 'Paused'}</Badge>
        <Badge>{jobTypeLabel(s.job_type)}</Badge>
      </div>

      <Panel title="Timetable" flush>
        <StatGroup label="Schedule timing">
          <Stat
            label="Runs"
            value={
              <span className={styles.wrapValue}>{cronLabel(s.cron_expr, s.cron_description)}</span>
            }
            foot={`Cron ${s.cron_expr}`}
          />
          <Stat
            label="Next run"
            value={s.is_active ? at(s.next_run_at) : 'Paused'}
            foot={s.is_active && s.next_run_at ? timeUntil(s.next_run_at) : 'Resume to schedule it'}
          />
          <Stat
            label="Last run"
            value={at(s.last_run_at)}
            foot={s.last_run_at ? fmt.relative(s.last_run_at) : 'Never run'}
          />
          <Stat label="Created" value={fmt.date(s.created_at)} foot={fmt.relative(s.created_at)} />
        </StatGroup>
      </Panel>

      <div className={styles.cols}>
        <Panel title="Settings">
          <dl className={styles.kv}>
            <div className={styles.kvRow}>
              <dt>Job</dt>
              <dd>{jobTypeLabel(s.job_type)}</dd>
            </div>
            <div className={styles.kvRow}>
              <dt>Cron</dt>
              <dd>
                <code className={styles.code}>{s.cron_expr}</code>
              </dd>
            </div>
            <div className={styles.kvRow}>
              <dt>Time zone</dt>
              <dd>UTC</dd>
            </div>
            {params.map((p) => (
              <div key={p.label} className={styles.kvRow}>
                <dt>{p.label}</dt>
                <dd>{p.value}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel title="Upcoming runs" flush>
          {!s.is_active ? (
            <p className={styles.empty}>Paused. Resume it to see the next runs.</p>
          ) : upcoming.length === 0 ? (
            <p className={styles.empty}>No upcoming runs.</p>
          ) : (
            <ol className={styles.upcoming} aria-label="Upcoming runs">
              {upcoming.map((r) => (
                <li key={r}>
                  <span>{fmt.date(r, DateStyle.DateTime)}</span>
                  <span>{timeUntil(r)}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <Panel
        title="Recent jobs"
        flush
        actions={
          <Link to="/jobs" className={buttonClass(ButtonVariant.Ghost, ControlSize.Sm)}>
            All jobs
          </Link>
        }
      >
        {jobs.length === 0 ? (
          <EmptyState
            compact
            title="No runs yet"
            description="Jobs this schedule starts appear here. Run it now to try it."
          />
        ) : (
          <JobList jobs={jobs} label="Recent jobs" hideSchedule />
        )}
      </Panel>
      {d.dialogs}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className={styles.page} aria-busy>
      <Skeleton width={180} height={22} />
      <Panel title="Timetable">
        <Skeleton lines={2} />
      </Panel>
      <Panel title="Recent jobs">
        <Skeleton lines={4} />
      </Panel>
    </div>
  );
}
