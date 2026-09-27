import { CircleX, RefreshCw, Split } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageActions } from '@/app/shell/PageActions';
import { useSetPageMeta } from '@/app/shell/routeMeta';
import { toApiError } from '@/api/client';
import { JobStatus, JobType, type BackgroundJobDetail } from '@/api/types';
import { DateStyle } from '@/lib/format';
import { usePreferences } from '@/lib/preferences';
import {
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
} from '@/ui';
import { BankReportPanel } from '../components/BankReportPanel';
import { DriftReportPanel } from '../components/DriftReportPanel';
import { JobStatusBadge, ScheduleBadge } from '../components/JobBadges';
import { SyncWizard } from '../components/SyncWizard';
import { BulkSyncReportPanel, PortfolioReportPanel } from '../components/SyncReports';
import {
  canRetry,
  useJob,
  useJobReport,
  useRetryJob,
  type JobReports,
} from '../hooks/useJobQueries';
import { hasSyncable } from '../lib/driftModel';
import {
  durationMs,
  formatDuration,
  inputEntries,
  isJobActive,
  JOB_ROUTE,
  JOB_TYPE_LABEL,
  jobTypeFromRoute,
  prettyJson,
} from '../lib/jobModel';
import { useBankOptions } from '@/features/schedules/hooks/useScheduleQueries';
import styles from '../components/Jobs.module.css';

const JOBS_CRUMB = [{ label: 'Jobs', to: '/jobs' }];

function NotFound({ title, description }: { title: string; description: string }) {
  return (
    <div className={styles.page}>
      <Panel>
        <EmptyState
          title={title}
          description={description}
          action={
            <Link to="/jobs" className={buttonClass(ButtonVariant.Secondary, ControlSize.Md)}>
              Back to jobs
            </Link>
          }
        />
      </Panel>
    </div>
  );
}

/** `/jobs/:type/:id`: timing, input, error and the typed result of one job. Polls while it runs. */
export function JobDetailPage() {
  const { type: segment, id = '' } = useParams();
  const type = jobTypeFromRoute(segment);
  useSetPageMeta(type ? JOB_TYPE_LABEL[type] : 'Job', JOBS_CRUMB);
  if (!type)
    return (
      <NotFound
        title="Unknown job type"
        description={`There is no job type called "${segment ?? ''}".`}
      />
    );
  return <JobDetailView type={type} id={id} />;
}

function JobDetailView({ type, id }: { type: JobType; id: string }) {
  const q = useJob(id);
  const job = q.data;

  if (q.error && !job)
    return toApiError(q.error).status === 404 ? (
      <NotFound
        title="Job not found"
        description="It may have been cleaned up, or the link is wrong."
      />
    ) : (
      <div className={styles.page}>
        <Panel>
          <ErrorState
            error={q.error}
            title="Could not load this job"
            onRetry={() => void q.refetch()}
          />
        </Panel>
      </div>
    );
  if (!job) return <DetailSkeleton />;
  return <JobBody type={type} job={job} />;
}

/** Ticks once a second while `on`, for the elapsed time of a running job. */
function useNow(on: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [on]);
  return now;
}

function JobBody({ type, job }: { type: JobType; job: BackgroundJobDetail }) {
  const { fmt } = usePreferences();
  const active = isJobActive(job.status);
  const done = job.status === JobStatus.COMPLETED;
  const now = useNow(active && !!job.started_at);
  const report = useJobReport(type, job.id, done);
  const retry = useRetryJob(type);
  const [wizard, setWizard] = useState(0);
  const [wizardOpen, setWizardOpen] = useState(false);

  const elapsed = active
    ? durationMs(job.started_at, new Date(now).toISOString())
    : durationMs(job.started_at ?? job.created_at, job.completed_at);
  const drift =
    type === JobType.DRIFT_DETECTION && report.data
      ? (report.data as JobReports[JobType.DRIFT_DETECTION])
      : null;
  const clock = (v?: string | null) => (v ? fmt.date(v, DateStyle.Time) : '--');
  const day = (v?: string | null) =>
    v ? `${fmt.date(v, DateStyle.Short)}, ${fmt.relative(v)}` : 'Not yet';

  return (
    <div className={styles.page}>
      <PageActions>
        {drift && hasSyncable(drift) ? (
          <Button
            variant={ButtonVariant.Primary}
            icon={<Split aria-hidden />}
            onClick={() => {
              setWizard((n) => n + 1);
              setWizardOpen(true);
            }}
          >
            Sync with provider
          </Button>
        ) : null}
        {!active && canRetry(type, job.input) ? (
          <Button
            icon={<RefreshCw aria-hidden />}
            loading={retry.isPending}
            onClick={() => retry.mutate({ id: job.id, input: job.input })}
          >
            {type === JobType.BANK_SYNC ? 'Sync again' : 'Retry'}
          </Button>
        ) : null}
      </PageActions>

      <div className={styles.head}>
        <JobStatusBadge status={job.status} />
        <span className={styles.headId}>#{job.id}</span>
        {job.schedule_id ? <ScheduleBadge scheduleId={job.schedule_id} /> : null}
        {job.previous_job_id ? (
          <Link className={styles.schedLink} to={`/jobs/${JOB_ROUTE[type]}/${job.previous_job_id}`}>
            Retry of #{job.previous_job_id.slice(0, 8)}
          </Link>
        ) : null}
      </div>

      <Panel title="Timing" flush>
        <StatGroup label="Job timing">
          <Stat label="Created" value={clock(job.created_at)} foot={day(job.created_at)} />
          <Stat label="Started" value={clock(job.started_at)} foot={day(job.started_at)} />
          <Stat label="Completed" value={clock(job.completed_at)} foot={day(job.completed_at)} />
          <Stat
            label={active ? 'Elapsed' : 'Duration'}
            value={active && !job.started_at ? 'Waiting' : formatDuration(elapsed)}
            foot={active ? 'So far' : 'Start to finish'}
          />
        </StatGroup>
      </Panel>

      {active ? (
        <Panel title="Progress">
          <div className={styles.progress} role="status">
            <div className={styles.progressBar} aria-hidden />
            <p className={styles.progressText}>
              {job.status === JobStatus.PENDING
                ? 'Queued. The worker picks it up shortly.'
                : 'Running. This page updates every 2 seconds.'}
            </p>
          </div>
        </Panel>
      ) : null}

      {job.status === JobStatus.FAILED ? (
        <Panel title="Error" flush>
          <p className={styles.error} role="alert">
            <CircleX aria-hidden />
            <span>{job.error || 'The job failed without an error message.'}</span>
          </p>
        </Panel>
      ) : null}

      {done ? <ReportSection type={type} query={report} /> : null}

      <InputPanel job={job} />

      {job.result ? (
        <Panel flush>
          <details className={styles.raw}>
            <summary>Raw result</summary>
            <pre className={styles.pre}>{prettyJson(job.result)}</pre>
          </details>
        </Panel>
      ) : null}

      {drift && wizard > 0 ? (
        <SyncWizard key={wizard} open={wizardOpen} onOpenChange={setWizardOpen} report={drift} />
      ) : null}
    </div>
  );
}

function ReportSection({ type, query }: { type: JobType; query: ReturnType<typeof useJobReport> }) {
  if (query.isPending)
    return (
      <Panel title="Result">
        <Skeleton lines={4} />
      </Panel>
    );
  if (query.error)
    return (
      <Panel title="Result">
        <ErrorState
          error={query.error}
          title="Could not load the result"
          onRetry={() => void query.refetch()}
        />
      </Panel>
    );
  const data = query.data;
  if (!data)
    return (
      <Panel title="Result">
        <p className={styles.empty}>This job finished without a result.</p>
      </Panel>
    );
  switch (type) {
    case JobType.DRIFT_DETECTION:
      return <DriftReportPanel report={data as JobReports[JobType.DRIFT_DETECTION]} />;
    case JobType.BULK_SYNC:
      return <BulkSyncReportPanel report={data as JobReports[JobType.BULK_SYNC]} />;
    case JobType.PORTFOLIO_SYNC:
      return <PortfolioReportPanel report={data as JobReports[JobType.PORTFOLIO_SYNC]} />;
    case JobType.BANK_SYNC:
      return <BankReportPanel report={data as JobReports[JobType.BANK_SYNC]} />;
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function inputValue(key: string, value: unknown, fmtDate: (v: string) => string): ReactNode {
  if (key === 'schedule_id' && typeof value === 'string')
    return <Link to={`/schedules/${value}`}>#{value.slice(0, 8)}</Link>;
  if (key === 'account_id' && typeof value === 'string')
    return <Link to={`/accounts/${value}`}>#{value.slice(0, 8)}</Link>;
  if (key === 'bank_provider_id' && typeof value === 'string') return <BankName id={value} />;
  if (Array.isArray(value)) return `${value.length} ${value.length === 1 ? 'item' : 'items'}`;
  if (value === null || value === undefined || value === '') return 'Not set';
  if (typeof value === 'string') return ISO_DATE.test(value) ? fmtDate(value) : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return 'See raw input';
}

/** A bank connection's account and provider, looked up only when a job's input names one. */
function BankName({ id }: { id: string }) {
  const banks = useBankOptions();
  return <>{banks.options.find((b) => b.id === id)?.name ?? `#${id.slice(0, 8)}`}</>;
}

function InputPanel({ job }: { job: BackgroundJobDetail }) {
  const { fmt } = usePreferences();
  const entries = inputEntries(job.input);
  const fmtDate = (v: string) => fmt.date(v, DateStyle.DateTime);
  return (
    <Panel title="Input" flush>
      {entries.length === 0 ? (
        <p className={styles.empty}>This job took no input.</p>
      ) : (
        <>
          <div className={styles.kvBody}>
            <dl className={styles.kv}>
              {entries.map((e) => (
                <div key={e.key} className={styles.kvRow}>
                  <dt>{e.label}</dt>
                  <dd>{inputValue(e.key, e.value, fmtDate)}</dd>
                </div>
              ))}
            </dl>
          </div>
          <details className={styles.raw}>
            <summary>Raw input</summary>
            <pre className={styles.pre}>{prettyJson(job.input)}</pre>
          </details>
        </>
      )}
    </Panel>
  );
}

function DetailSkeleton() {
  return (
    <div className={styles.page} aria-busy>
      <Skeleton width={220} height={22} />
      <Panel title="Timing">
        <Skeleton lines={2} />
      </Panel>
      <Panel title="Input">
        <Skeleton lines={3} />
      </Panel>
    </div>
  );
}
