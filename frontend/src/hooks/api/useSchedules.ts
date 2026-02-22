import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listSchedules,
  getSchedule,
  createSchedule,
  updateSchedule,
  deleteSchedule,
} from '@/services/scheduleService';
import type { CreateScheduleRequest, UpdateScheduleRequest } from '@/types';

/**
 * Fetch all schedules for the current user
 * @returns React Query result with schedules array
 */
export function useSchedules() {
  return useQuery({
    queryKey: ['schedules'],
    queryFn: listSchedules,
  });
}

/**
 * Fetch a single schedule with recent jobs and upcoming runs
 * @param id - Schedule ID, or null to disable
 * @returns React Query result with schedule detail response
 */
export function useSchedule(id: string | null) {
  return useQuery({
    queryKey: ['schedules', id],
    queryFn: () => getSchedule(id!),
    enabled: !!id,
  });
}

/**
 * Create a new schedule
 * Invalidates schedules list on success
 * @returns React Query mutation for creating a schedule
 */
export function useCreateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateScheduleRequest) => createSchedule(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

/**
 * Update an existing schedule
 * Invalidates schedules list and detail on success
 * @returns React Query mutation for updating a schedule
 */
export function useUpdateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: UpdateScheduleRequest }) =>
      updateSchedule(id, request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

/**
 * Delete a schedule
 * Invalidates schedules list on success
 * @returns React Query mutation for deleting a schedule
 */
export function useDeleteSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteSchedule(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}
