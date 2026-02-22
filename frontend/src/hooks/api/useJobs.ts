import { useQuery } from '@tanstack/react-query';
import { listJobs } from '@/services/jobService';
import type { ListJobsParams } from '@/services/jobService';

/**
 * Fetch background jobs for the current user
 * @param params - Optional filters: job_type, limit, offset
 * @returns React Query result with job summaries array
 */
export function useJobs(params?: ListJobsParams) {
  return useQuery({
    queryKey: ['jobs', params],
    queryFn: () => listJobs(params),
  });
}
