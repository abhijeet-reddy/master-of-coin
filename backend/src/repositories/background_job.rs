use chrono::{DateTime, Utc};
use diesel::prelude::*;
use uuid::Uuid;

use crate::DbPool;
use crate::errors::{ApiError, ApiResult};
use crate::models::background_job::{BackgroundJob, NewBackgroundJob};
use crate::schema::background_jobs;
use crate::types::{JobStatus, JobType};

/// Repository for background job database operations
pub struct BackgroundJobRepository;

impl BackgroundJobRepository {
    /// Insert a new background job row
    pub fn create_job(pool: &DbPool, new_job: NewBackgroundJob) -> ApiResult<BackgroundJob> {
        let mut conn = pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;

        let job = diesel::insert_into(background_jobs::table)
            .values(&new_job)
            .get_result::<BackgroundJob>(&mut conn)?;

        Ok(job)
    }

    /// Find a single job by ID
    pub fn find_by_id(pool: &DbPool, job_id: Uuid) -> ApiResult<Option<BackgroundJob>> {
        let mut conn = pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;

        let job = background_jobs::table
            .find(job_id)
            .first::<BackgroundJob>(&mut conn)
            .optional()?;

        Ok(job)
    }

    /// List all jobs for a user of a specific type, ordered by created_at DESC
    pub fn find_by_user_and_type(
        pool: &DbPool,
        user_id: Uuid,
        job_type: JobType,
    ) -> ApiResult<Vec<BackgroundJob>> {
        let mut conn = pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;

        let jobs = background_jobs::table
            .filter(background_jobs::user_id.eq(user_id))
            .filter(background_jobs::job_type.eq(job_type))
            .order(background_jobs::created_at.desc())
            .load::<BackgroundJob>(&mut conn)?;

        Ok(jobs)
    }

    /// List jobs for a user with optional type filter and pagination.
    ///
    /// Returns jobs ordered by `created_at DESC` with `LIMIT` and `OFFSET`
    /// applied for pagination. If `job_type` is `Some`, only jobs of that
    /// type are returned.
    pub fn list_by_user(
        pool: &DbPool,
        user_id: Uuid,
        job_type: Option<JobType>,
        limit: i64,
        offset: i64,
    ) -> ApiResult<Vec<BackgroundJob>> {
        let mut conn = pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;

        let mut query = background_jobs::table
            .filter(background_jobs::user_id.eq(user_id))
            .order(background_jobs::created_at.desc())
            .into_boxed();

        if let Some(jt) = job_type {
            query = query.filter(background_jobs::job_type.eq(jt));
        }

        let jobs = query
            .limit(limit)
            .offset(offset)
            .load::<BackgroundJob>(&mut conn)?;

        Ok(jobs)
    }

    /// Find all jobs with status = RUNNING (for startup recovery)
    pub fn find_stale_jobs(pool: &DbPool) -> ApiResult<Vec<BackgroundJob>> {
        let mut conn = pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;

        let jobs = background_jobs::table
            .filter(background_jobs::status.eq(JobStatus::Running))
            .load::<BackgroundJob>(&mut conn)?;

        Ok(jobs)
    }

    /// Find the oldest PENDING job, optionally excluding certain job types
    /// (for one-per-type concurrency). ORDER BY created_at ASC, LIMIT 1
    pub fn find_next_pending(
        pool: &DbPool,
        exclude_types: &[JobType],
    ) -> ApiResult<Option<BackgroundJob>> {
        let mut conn = pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;

        let mut query = background_jobs::table
            .filter(background_jobs::status.eq(JobStatus::Pending))
            .order(background_jobs::created_at.asc())
            .into_boxed();

        if !exclude_types.is_empty() {
            query = query.filter(background_jobs::job_type.ne_all(exclude_types.to_vec()));
        }

        let job = query.first::<BackgroundJob>(&mut conn).optional()?;

        Ok(job)
    }

    /// Set status = RUNNING, started_at = now()
    pub fn update_running(pool: &DbPool, job_id: Uuid) -> ApiResult<BackgroundJob> {
        let mut conn = pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;

        let job = diesel::update(background_jobs::table.find(job_id))
            .set((
                background_jobs::status.eq(JobStatus::Running),
                background_jobs::started_at.eq(diesel::dsl::now),
            ))
            .get_result::<BackgroundJob>(&mut conn)?;

        Ok(job)
    }

    /// Set status = COMPLETED, result = result_json, completed_at = now()
    pub fn update_completed(
        pool: &DbPool,
        job_id: Uuid,
        result_json: serde_json::Value,
    ) -> ApiResult<BackgroundJob> {
        let mut conn = pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;

        let job = diesel::update(background_jobs::table.find(job_id))
            .set((
                background_jobs::status.eq(JobStatus::Completed),
                background_jobs::result.eq(result_json),
                background_jobs::completed_at.eq(diesel::dsl::now),
            ))
            .get_result::<BackgroundJob>(&mut conn)?;

        Ok(job)
    }

    /// Set status = FAILED, error = error_msg, completed_at = now()
    pub fn update_failed(pool: &DbPool, job_id: Uuid, error_msg: &str) -> ApiResult<BackgroundJob> {
        let mut conn = pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;

        let job = diesel::update(background_jobs::table.find(job_id))
            .set((
                background_jobs::status.eq(JobStatus::Failed),
                background_jobs::error.eq(error_msg),
                background_jobs::completed_at.eq(diesel::dsl::now),
            ))
            .get_result::<BackgroundJob>(&mut conn)?;

        Ok(job)
    }

    /// DELETE FROM background_jobs WHERE status IN (COMPLETED, FAILED) AND created_at < older_than
    /// Returns count of deleted rows
    pub fn cleanup_old_jobs(pool: &DbPool, older_than: DateTime<Utc>) -> ApiResult<usize> {
        let mut conn = pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;

        let terminal_statuses = vec![JobStatus::Completed, JobStatus::Failed];

        let count = diesel::delete(
            background_jobs::table
                .filter(background_jobs::status.eq_any(terminal_statuses))
                .filter(background_jobs::created_at.lt(older_than)),
        )
        .execute(&mut conn)?;

        Ok(count)
    }
}
