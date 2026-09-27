import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { u, useUrlState } from '@/lib/urlState';
import {
  Button,
  buttonClass,
  ButtonVariant,
  ControlSize,
  EmptyState,
  IconButton,
  Panel,
  PanelState,
  Select,
} from '@/ui';
import { JobList, JobListSkeleton } from '../components/JobList';
import { useJobs } from '../hooks/useJobQueries';
import {
  JOB_ROUTE,
  JOB_TYPE_LABEL,
  JOB_TYPES,
  JOBS_PAGE_SIZE,
  jobTypeFromRoute,
  pageOf,
} from '../lib/jobModel';
import styles from '../components/Jobs.module.css';

const ALL = 'all';
const TYPE_VALUES = [ALL, ...JOB_TYPES.map((t) => JOB_ROUTE[t])] as [string, ...string[]];
const schema = z.object({ type: u.enum(TYPE_VALUES, ALL), page: u.number(1) });
const TYPE_OPTIONS = [
  { value: ALL, label: 'All types' },
  ...JOB_TYPES.map((t) => ({ value: JOB_ROUTE[t], label: JOB_TYPE_LABEL[t] })),
];

/** `/jobs`: every background job, newest first, filterable by type. */
export function JobsPage() {
  const [params, setParams] = useUrlState(schema);
  const page = Math.max(1, Math.floor(params.page));
  const jobType = jobTypeFromRoute(params.type) ?? undefined;
  const jobs = useJobs(page, jobType);
  const typeLabel = jobType ? JOB_TYPE_LABEL[jobType] : null;

  return (
    <div className={styles.page}>
      <p className={styles.intro}>
        Drift checks, split syncs, portfolio and bank syncs run in the background. Open one to see
        its input, its result and any error.
      </p>
      <Panel
        title="Job history"
        flush
        actions={
          <Link to="/schedules" className={buttonClass(ButtonVariant.Ghost, ControlSize.Sm)}>
            Schedules
          </Link>
        }
      >
        <div className={styles.bar}>
          <div className={styles.filter}>
            <span className={styles.micro} id="job-type-label">
              Type
            </span>
            <Select
              aria-label="Job type"
              value={params.type}
              onValueChange={(v) => setParams({ type: v, page: 1 }, { history: 'push' })}
              options={TYPE_OPTIONS}
            />
          </div>
          {jobs.isFetching && jobs.data ? <span className={styles.micro}>Updating</span> : null}
        </div>
        <PanelState
          query={jobs}
          skeleton={<JobListSkeleton />}
          empty={(d) =>
            d.length === 0 ? (
              page > 1 ? (
                <EmptyState
                  compact
                  title="This page is empty"
                  action={
                    <Button onClick={() => setParams({ page: 1 }, { history: 'push' })}>
                      First page
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  title={typeLabel ? `No ${typeLabel.toLowerCase()} jobs yet` : 'No jobs yet'}
                  description="Jobs appear here when you run a drift check or a sync, or when a schedule runs."
                  action={
                    typeLabel ? (
                      <Button onClick={() => setParams({ type: ALL, page: 1 })}>
                        Show all types
                      </Button>
                    ) : undefined
                  }
                />
              )
            ) : null
          }
        >
          {(d) => {
            const { rows, hasNext } = pageOf(d);
            const from = (page - 1) * JOBS_PAGE_SIZE + 1;
            return (
              <>
                <JobList jobs={rows} label="Job history" />
                {page > 1 || hasNext ? (
                  <nav className={styles.foot} aria-label="Pagination">
                    <span aria-live="polite">
                      Showing {from} to {from + rows.length - 1}
                    </span>
                    <span className={styles.pager}>
                      <IconButton
                        label="Previous page"
                        icon={<ChevronLeft />}
                        variant={ButtonVariant.Secondary}
                        size={ControlSize.Sm}
                        disabled={page <= 1}
                        onClick={() => setParams({ page: page - 1 }, { history: 'push' })}
                      />
                      <span>Page {page}</span>
                      <IconButton
                        label="Next page"
                        icon={<ChevronRight />}
                        variant={ButtonVariant.Secondary}
                        size={ControlSize.Sm}
                        disabled={!hasNext}
                        onClick={() => setParams({ page: page + 1 }, { history: 'push' })}
                      />
                    </span>
                  </nav>
                ) : null}
              </>
            );
          }}
        </PanelState>
      </Panel>
    </div>
  );
}
