use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::errors::ApiError;
use crate::models::background_job::BackgroundJob;
use crate::types::{JobStatus, JobType};

/// Lightweight response type for the jobs list endpoint.
///
/// Contains job metadata and an optional `summary` extracted from the
/// result JSONB column. The full report is NOT included — callers should
/// use the type-specific detail endpoints for that.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackgroundJobSummary {
    pub id: Uuid,
    pub job_type: JobType,
    pub status: JobStatus,
    pub created_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub started_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<serde_json::Value>,
    /// Schedule that triggered the job (from `input.schedule_id`); null for
    /// manually started jobs.
    pub schedule_id: Option<Uuid>,
}

impl BackgroundJobSummary {
    /// Build a summary from a job row. `summary` is the `summary` key of the
    /// result JSON when present; `schedule_id` comes from `input.schedule_id`.
    pub fn from_job(job: &BackgroundJob) -> Self {
        Self {
            id: job.id,
            job_type: job.job_type,
            status: job.status,
            created_at: job.created_at,
            started_at: job.started_at,
            completed_at: job.completed_at,
            error: job.error.clone(),
            summary: job.result.as_ref().and_then(|r| r.get("summary").cloned()),
            schedule_id: schedule_id_of(job),
        }
    }
}

/// The schedule id recorded in a job's input, if any.
pub fn schedule_id_of(job: &BackgroundJob) -> Option<Uuid> {
    job.input
        .as_ref()
        .and_then(|i| i.get("schedule_id"))
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok())
}

/// Response for `GET /api/v1/jobs/:id`: the summary fields plus the job's
/// full input and result.
#[derive(Debug, Clone, Serialize)]
pub struct BackgroundJobDetail {
    #[serde(flatten)]
    pub summary: BackgroundJobSummary,
    pub previous_job_id: Option<Uuid>,
    pub input: Option<serde_json::Value>,
    pub result: Option<serde_json::Value>,
}

impl BackgroundJobDetail {
    pub fn from_job(job: BackgroundJob) -> Self {
        Self {
            summary: BackgroundJobSummary::from_job(&job),
            previous_job_id: job.previous_job_id,
            input: job.input,
            result: job.result,
        }
    }
}

/// Parse a `job_type` string (the serde form of [`JobType`], e.g.
/// `"DRIFT_DETECTION"`). Case-sensitive.
pub fn parse_job_type(value: &str) -> Result<JobType, ApiError> {
    match value {
        "DRIFT_DETECTION" => Ok(JobType::DriftDetection),
        "BULK_SYNC" => Ok(JobType::BulkSync),
        "PORTFOLIO_SYNC" => Ok(JobType::PortfolioSync),
        "BANK_SYNC" => Ok(JobType::BankSync),
        other => Err(ApiError::BadRequest(format!(
            "Invalid job_type '{}'. Must be DRIFT_DETECTION, BULK_SYNC, PORTFOLIO_SYNC, or BANK_SYNC",
            other
        ))),
    }
}

/// Query parameters for `GET /api/v1/jobs`.
///
/// All fields are optional:
/// - `job_type`: filter by `"DRIFT_DETECTION"` or `"BULK_SYNC"`
/// - `limit`: max results (default 50)
/// - `offset`: pagination offset (default 0)
#[derive(Debug, Clone, Deserialize)]
pub struct ListJobsQuery {
    pub job_type: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}
