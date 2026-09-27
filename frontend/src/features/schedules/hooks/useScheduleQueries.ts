/** Schedule reads and writes. Run now opens the job it queued. */
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getAccountsWithArchived } from '@/api/accounts';
import { listBankProviders } from '@/api/bankProviders';
import { toApiError } from '@/api/client';
import { BankProviderType } from '@/api/types/bankProvider';
import { keys } from '@/api/keys';
import {
  createSchedule,
  deleteSchedule,
  getSchedule,
  listSchedules,
  runScheduleNow,
  updateSchedule,
} from '@/api/schedules';
import type { CreateScheduleRequest, JobType, Schedule, UpdateScheduleRequest } from '@/api/types';
import { JOB_ROUTE } from '@/features/jobs';
import { toast } from '@/ui';

export const useSchedules = () =>
  useQuery({ queryKey: keys.schedules.all, queryFn: listSchedules });

export const useSchedule = (id: string) =>
  useQuery({ queryKey: keys.schedules.detail(id), queryFn: () => getSchedule(id), enabled: !!id });

const refresh = (qc: QueryClient) => {
  void qc.invalidateQueries({ queryKey: keys.schedules.all });
  void qc.invalidateQueries({ queryKey: keys.jobs.all });
};

export type SaveScheduleVars =
  | { id: string; patch: UpdateScheduleRequest }
  | { body: CreateScheduleRequest };

export function useSaveSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: SaveScheduleVars): Promise<Schedule> =>
      'patch' in v ? updateSchedule(v.id, v.patch) : createSchedule(v.body),
    onSuccess: (s, v) => {
      refresh(qc);
      toast.success('patch' in v ? 'Schedule saved' : 'Schedule created', { description: s.name });
    },
  });
}

export function useToggleSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: Pick<Schedule, 'id' | 'name' | 'is_active'>) =>
      updateSchedule(s.id, { is_active: !s.is_active }),
    onSuccess: (s) => {
      refresh(qc);
      toast.success(s.is_active ? 'Schedule resumed' : 'Schedule paused', { description: s.name });
    },
    onError: (e) =>
      toast.error('Could not update the schedule', { description: toApiError(e).message }),
  });
}

export function useDeleteSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: Pick<Schedule, 'id' | 'name'>) => deleteSchedule(s.id),
    onSuccess: (_v, s) => {
      qc.removeQueries({ queryKey: keys.schedules.detail(s.id) });
      refresh(qc);
      toast.success('Schedule deleted', { description: s.name });
    },
  });
}

/** Queue the schedule's job now, then open it. */
export function useRunScheduleNow() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (s: Pick<Schedule, 'id' | 'name' | 'job_type'>) => runScheduleNow(s.id),
    onSuccess: ({ jobId }, s) => {
      refresh(qc);
      const route = JOB_ROUTE[s.job_type as JobType];
      if (!jobId || !route) {
        toast.success('Job queued', { description: s.name });
        return;
      }
      toast.success('Job queued', { description: `${s.name}, opened the new job.` });
      void navigate(`/jobs/${route}/${jobId}`);
    },
    onError: (e) =>
      toast.error('Could not run the schedule', { description: toApiError(e).message }),
  });
}

export interface BankOption {
  id: string;
  name: string;
}

/** Bank connections named after the account each one feeds. */
export function useBankOptions() {
  const providers = useQuery({ queryKey: keys.bankProviders, queryFn: listBankProviders });
  const accounts = useQuery({
    queryKey: keys.accounts.withArchived,
    queryFn: getAccountsWithArchived,
  });
  const byId = new Map((accounts.data ?? []).map((a) => [a.id, a.name]));
  const options: BankOption[] = (providers.data ?? []).map((p) => ({
    id: p.id,
    name: `${byId.get(p.account_id) ?? 'Unknown account'} (${p.provider_type === BankProviderType.TRUELAYER ? 'TrueLayer' : p.provider_type})`,
  }));
  return {
    options,
    isPending: providers.isPending,
    nameOf: (id: string) => options.find((o) => o.id === id)?.name,
  };
}
