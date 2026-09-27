//! Schedule orchestration shared by the API and the worker: building a
//! job's input from a schedule, and running a schedule on demand.

use chrono::{DateTime, Duration, Utc};
use uuid::Uuid;

use crate::{
    DbPool,
    errors::ApiError,
    models::{
        background_job::{BackgroundJob, NewBackgroundJob},
        schedule::Schedule,
    },
    repositories::{background_job::BackgroundJobRepository, schedule::ScheduleRepository},
    types::{JobStatus, JobType},
};

/// Default drift-detection lookback when the schedule does not set one.
pub const DEFAULT_DRIFT_LOOKBACK_DAYS: i64 = 7;

/// Build the job input JSON from the schedule's `job_type` and `parameters`.
///
/// Every input carries `schedule_id` (which is how jobs link back to their
/// schedule).
/// - `DRIFT_DETECTION`: `start_date = now - lookback_days` (default 7) and
///   `end_date = now`.
/// - `BULK_SYNC`, `PORTFOLIO_SYNC`, `BANK_SYNC`: the schedule's parameters.
pub fn build_job_input(schedule: &Schedule, now: DateTime<Utc>) -> serde_json::Value {
    let schedule_id = schedule.id.to_string();

    match schedule.job_type {
        JobType::DriftDetection => {
            let lookback_days = schedule
                .parameters
                .as_ref()
                .and_then(|p| p.get("lookback_days"))
                .and_then(|v| v.as_i64())
                .unwrap_or(DEFAULT_DRIFT_LOOKBACK_DAYS);

            serde_json::json!({
                "schedule_id": schedule_id,
                "start_date": (now - Duration::days(lookback_days)).to_rfc3339(),
                "end_date": now.to_rfc3339()
            })
        }
        JobType::BulkSync | JobType::PortfolioSync | JobType::BankSync => {
            let mut input = schedule
                .parameters
                .clone()
                .filter(|p| p.is_object())
                .unwrap_or_else(|| serde_json::json!({}));
            if let Some(obj) = input.as_object_mut() {
                obj.insert(
                    "schedule_id".to_string(),
                    serde_json::Value::String(schedule_id),
                );
            }
            input
        }
    }
}

/// The pending job a schedule run creates.
pub fn new_job_for(schedule: &Schedule, now: DateTime<Utc>) -> NewBackgroundJob {
    NewBackgroundJob {
        user_id: schedule.user_id,
        job_type: schedule.job_type,
        status: JobStatus::Pending,
        previous_job_id: None,
        input: Some(build_job_input(schedule, now)),
    }
}

/// Queue a job for the schedule now, without moving its `next_run_at`.
/// Works for paused schedules too. 404 when missing or not the user's.
pub fn run_now(pool: &DbPool, user_id: Uuid, schedule_id: Uuid) -> Result<BackgroundJob, ApiError> {
    let schedule = ScheduleRepository::find_by_id(pool, schedule_id)?
        .filter(|s| s.user_id == user_id)
        .ok_or_else(|| ApiError::NotFound("Schedule not found".to_string()))?;

    let job = BackgroundJobRepository::create_job(pool, new_job_for(&schedule, Utc::now()))?;
    tracing::info!(
        "Queued job {} ({:?}) from schedule {} on demand",
        job.id,
        schedule.job_type,
        schedule.id
    );
    Ok(job)
}
