use chrono::{DateTime, Utc};
use diesel::prelude::*;
use uuid::Uuid;

use crate::DbPool;
use crate::errors::{ApiError, ApiResult};
use crate::models::background_job::{BackgroundJob, NewBackgroundJob};
use crate::models::schedule::{NewSchedule, Schedule, UpdateSchedule};
use crate::schema::{background_jobs, schedules};

/// Repository for schedule database operations.
pub struct ScheduleRepository;

impl ScheduleRepository {
    /// Insert a new schedule row.
    pub fn create(pool: &DbPool, new_schedule: NewSchedule) -> ApiResult<Schedule> {
        let mut conn = pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;

        let schedule = diesel::insert_into(schedules::table)
            .values(&new_schedule)
            .get_result::<Schedule>(&mut conn)?;

        Ok(schedule)
    }

    /// List all schedules for a user, ordered by `created_at DESC`.
    pub fn list_by_user(pool: &DbPool, user_id: Uuid) -> ApiResult<Vec<Schedule>> {
        let mut conn = pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;

        let results = schedules::table
            .filter(schedules::user_id.eq(user_id))
            .order(schedules::created_at.desc())
            .load::<Schedule>(&mut conn)?;

        Ok(results)
    }

    /// Find a single schedule by ID.
    pub fn find_by_id(pool: &DbPool, schedule_id: Uuid) -> ApiResult<Option<Schedule>> {
        let mut conn = pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;

        let schedule = schedules::table
            .find(schedule_id)
            .first::<Schedule>(&mut conn)
            .optional()?;

        Ok(schedule)
    }

    /// Apply a partial update to a schedule.
    pub fn update(
        pool: &DbPool,
        schedule_id: Uuid,
        changeset: UpdateSchedule,
    ) -> ApiResult<Schedule> {
        let mut conn = pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;

        let schedule = diesel::update(schedules::table.find(schedule_id))
            .set(&changeset)
            .get_result::<Schedule>(&mut conn)?;

        Ok(schedule)
    }

    /// Delete a schedule by ID. Returns the number of rows deleted.
    pub fn delete(pool: &DbPool, schedule_id: Uuid) -> ApiResult<usize> {
        let mut conn = pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;

        let count = diesel::delete(schedules::table.find(schedule_id)).execute(&mut conn)?;

        Ok(count)
    }

    /// Find all active schedules whose `next_run_at` is due (i.e. <= NOW()).
    pub fn find_due_schedules(pool: &DbPool) -> ApiResult<Vec<Schedule>> {
        let mut conn = pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;

        let results = schedules::table
            .filter(schedules::is_active.eq(true))
            .filter(schedules::next_run_at.le(diesel::dsl::now))
            .load::<Schedule>(&mut conn)?;

        Ok(results)
    }

    /// Trigger a schedule: in a single transaction, INSERT a background job and
    /// UPDATE the schedule's `next_run_at` and `last_run_at`.
    ///
    /// This ensures atomicity — either both the job is created AND the schedule
    /// is updated, or neither happens.
    pub fn trigger_schedule(
        pool: &DbPool,
        schedule_id: Uuid,
        new_job: NewBackgroundJob,
        next_run_at: DateTime<Utc>,
    ) -> ApiResult<BackgroundJob> {
        let mut conn = pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;

        conn.transaction(|conn| {
            // 1. Insert the background job
            let job = diesel::insert_into(background_jobs::table)
                .values(&new_job)
                .get_result::<BackgroundJob>(conn)?;

            // 2. Update the schedule's next_run_at and last_run_at
            diesel::update(schedules::table.find(schedule_id))
                .set((
                    schedules::next_run_at.eq(next_run_at),
                    schedules::last_run_at.eq(diesel::dsl::now),
                    schedules::updated_at.eq(diesel::dsl::now),
                ))
                .execute(conn)?;

            Ok(job)
        })
    }

    /// Find recent background jobs associated with a schedule by querying
    /// the `input->>'schedule_id'` JSONB field.
    ///
    /// Returns up to `limit` jobs ordered by `created_at DESC`.
    pub fn find_jobs_by_schedule(
        pool: &DbPool,
        schedule_id: Uuid,
        limit: i64,
    ) -> ApiResult<Vec<BackgroundJob>> {
        let mut conn = pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;

        let schedule_id_str = schedule_id.to_string();

        // Use Diesel's JSONB text extraction operator: input->>'schedule_id'
        let jobs = background_jobs::table
            .filter(diesel::dsl::sql::<diesel::sql_types::Bool>(&format!(
                "input->>'schedule_id' = '{}'",
                schedule_id_str
            )))
            .order(background_jobs::created_at.desc())
            .limit(limit)
            .load::<BackgroundJob>(&mut conn)?;

        Ok(jobs)
    }
}
