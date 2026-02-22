use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

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
