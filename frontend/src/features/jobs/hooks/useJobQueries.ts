/** Job reads and writes. The detail polls while the job is queued or running. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getSyncJob, startSync } from '@/api/bankProviders';
import { getBulkSyncJob, retryBulkSync, startBulkSync } from '@/api/bulkSync';
import { toApiError } from '@/api/client';
import { getDriftJob, retryDriftJob } from '@/api/drift';
import { getPortfolioSyncJob, retryPortfolioSync } from '@/api/investmentProviders';
import { getJob, listJobs } from '@/api/jobs';
import { keys } from '@/api/keys';
import {
  JobType,
  type BulkSyncReport,
  type DriftReport,
  type PortfolioSyncReport,
  type SyncItem,
} from '@/api/types';
import type { BankSyncReport } from '@/api/types/bankProvider';
import { toast } from '@/ui';
import { isJobActive, jobListParams, JOB_ROUTE } from '../lib/jobModel';

const POLL_MS = 2000;
const LIST_POLL_MS = 5000;

export function useJobs(page: number, jobType?: JobType) {
  const params = jobListParams(page, jobType);
  return useQuery({
    queryKey: keys.jobs.list(params),
    queryFn: () => listJobs(params),
    placeholderData: keepPreviousData,
    refetchInterval: (q) =>
      q.state.data?.some((j) => isJobActive(j.status)) ? LIST_POLL_MS : false,
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: keys.jobs.detail(id),
    queryFn: () => getJob(id),
    enabled: !!id,
    refetchInterval: (q) => (isJobActive(q.state.data?.status) ? POLL_MS : false),
  });
}

export interface JobReports {
  [JobType.DRIFT_DETECTION]: DriftReport;
  [JobType.BULK_SYNC]: BulkSyncReport;
  [JobType.PORTFOLIO_SYNC]: PortfolioSyncReport;
  [JobType.BANK_SYNC]: BankSyncReport;
}

async function fetchReport(type: JobType, id: string): Promise<unknown> {
  switch (type) {
    case JobType.DRIFT_DETECTION:
      return (await getDriftJob(id)).result ?? null;
    case JobType.BULK_SYNC:
      return (await getBulkSyncJob(id)).result ?? null;
    case JobType.PORTFOLIO_SYNC:
      return (await getPortfolioSyncJob(id)).result ?? null;
    case JobType.BANK_SYNC:
      // The bank endpoint re-checks which rows are already imported on every read.
      return (await getSyncJob(id)).result ?? null;
  }
}

export const jobReportKey = (type: JobType, id: string) =>
  [...keys.jobs.all, 'report', type, id] as const;

/** The parsed report of a finished job, from its type's endpoint. */
export function useJobReport<T extends JobType>(type: T, id: string, enabled: boolean) {
  return useQuery({
    queryKey: jobReportKey(type, id),
    queryFn: () => fetchReport(type, id) as Promise<JobReports[T] | null>,
    enabled: enabled && !!id,
  });
}

/** Retry for the types that have it; bank sync starts a fresh sync of the same connection. */
export function canRetry(type: JobType, input: Record<string, unknown> | null | undefined) {
  if (type === JobType.BANK_SYNC) return typeof input?.bank_provider_id === 'string';
  return true;
}

export function useRetryJob(type: JobType) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input?: Record<string, unknown> | null;
    }): Promise<string> => {
      switch (type) {
        case JobType.DRIFT_DETECTION:
          return (await retryDriftJob(id)).job_id;
        case JobType.BULK_SYNC:
          return (await retryBulkSync(id)).job_id;
        case JobType.PORTFOLIO_SYNC:
          return (await retryPortfolioSync(id)).job_id;
        case JobType.BANK_SYNC: {
          const provider = input?.bank_provider_id;
          if (typeof provider !== 'string') throw new Error('This job has no bank connection.');
          return (await startSync(provider)).job_id;
        }
      }
    },
    onSuccess: (jobId) => {
      void qc.invalidateQueries({ queryKey: keys.jobs.all });
      toast.success('Job queued', { description: 'Opened the new job.' });
      void navigate(`/jobs/${JOB_ROUTE[type]}/${jobId}`);
    },
    onError: (e) => toast.error('Could not retry', { description: toApiError(e).message }),
  });
}

export function useStartBulkSync() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (items: SyncItem[]) => startBulkSync({ items }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: keys.jobs.all });
      toast.success('Sync started', {
        description: `${r.total_items} ${r.total_items === 1 ? 'item' : 'items'} queued.`,
      });
      void navigate(`/jobs/${JOB_ROUTE[JobType.BULK_SYNC]}/${r.job_id}`);
    },
  });
}
