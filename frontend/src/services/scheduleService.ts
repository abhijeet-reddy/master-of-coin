/** Schedules API service */

import apiClient from '@/lib/axios';
import type {
  Schedule,
  CreateScheduleRequest,
  UpdateScheduleRequest,
  ScheduleDetailResponse,
} from '@/types';

/**
 * Create a new schedule
 * @param request - Schedule configuration
 * @returns Created schedule
 */
export async function createSchedule(request: CreateScheduleRequest): Promise<Schedule> {
  const response = await apiClient.post<Schedule>('/schedules', request);
  return response.data;
}

/**
 * List all schedules for the current user
 * @returns Array of schedules
 */
export async function listSchedules(): Promise<Schedule[]> {
  const response = await apiClient.get<Schedule[]>('/schedules');
  return response.data;
}

/**
 * Get schedule details including recent jobs and upcoming runs
 * @param id - Schedule ID
 * @returns Schedule detail with recent jobs and upcoming runs
 */
export async function getSchedule(id: string): Promise<ScheduleDetailResponse> {
  const response = await apiClient.get<ScheduleDetailResponse>(`/schedules/${id}`);
  return response.data;
}

/**
 * Update an existing schedule
 * @param id - Schedule ID
 * @param request - Partial update fields
 * @returns Updated schedule
 */
export async function updateSchedule(
  id: string,
  request: UpdateScheduleRequest
): Promise<Schedule> {
  const response = await apiClient.put<Schedule>(`/schedules/${id}`, request);
  return response.data;
}

/**
 * Delete a schedule
 * @param id - Schedule ID
 */
export async function deleteSchedule(id: string): Promise<void> {
  await apiClient.delete(`/schedules/${id}`);
}
