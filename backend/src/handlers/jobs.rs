use axum::{
    Json,
    extract::{Extension, Query, State},
};

use crate::{
    AppState,
    auth::context::AuthContext,
    errors::ApiError,
    models::{
        background_job::BackgroundJob,
        job_summary::{BackgroundJobSummary, ListJobsQuery},
    },
    repositories::background_job::BackgroundJobRepository,
    types::JobType,
};

/// List all background jobs for the current user.
///
/// Supports optional filtering by `job_type` and pagination via `limit`/`offset`.
/// Returns a lightweight summary for each job — the full report is available
/// through the type-specific detail endpoints.
///
/// GET /api/v1/jobs
pub async fn list_jobs(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Query(params): Query<ListJobsQuery>,
) -> Result<Json<Vec<BackgroundJobSummary>>, ApiError> {
    let user_id = auth_context.user_id();

    let limit = params.limit.unwrap_or(50).min(200);
    let offset = params.offset.unwrap_or(0).max(0);

    let job_type = params.job_type.as_deref().map(parse_job_type).transpose()?;

    tracing::debug!(
        "Listing jobs for user {} (type={:?}, limit={}, offset={})",
        user_id,
        job_type,
        limit,
        offset,
    );

    let jobs = BackgroundJobRepository::list_by_user(&state.db, user_id, job_type, limit, offset)?;

    let summaries: Vec<BackgroundJobSummary> = jobs.iter().map(to_summary).collect();

    Ok(Json(summaries))
}

/// Parse a `job_type` query-string value into a [`JobType`] enum variant.
///
/// Accepts `"DRIFT_DETECTION"` and `"BULK_SYNC"` (case-sensitive, matching
/// the serde serialisation of [`JobType`]).
fn parse_job_type(value: &str) -> Result<JobType, ApiError> {
    match value {
        "DRIFT_DETECTION" => Ok(JobType::DriftDetection),
        "BULK_SYNC" => Ok(JobType::BulkSync),
        "PORTFOLIO_SYNC" => Ok(JobType::PortfolioSync),
        other => Err(ApiError::BadRequest(format!(
            "Invalid job_type '{}'. Must be DRIFT_DETECTION, BULK_SYNC, or PORTFOLIO_SYNC",
            other
        ))),
    }
}

/// Convert a full [`BackgroundJob`] row into a lightweight [`BackgroundJobSummary`].
///
/// The `summary` field is extracted from the `result` JSONB column:
/// - For `DRIFT_DETECTION`: extracts the `summary` key from the `DriftReport`
/// - For `BULK_SYNC`: extracts the `summary` key from the `BulkSyncReport`
/// - If `result` is `None` or parsing fails, `summary` is set to `None`
fn to_summary(job: &BackgroundJob) -> BackgroundJobSummary {
    let summary = job
        .result
        .as_ref()
        .and_then(|result_json| result_json.get("summary").cloned());

    BackgroundJobSummary {
        id: job.id,
        job_type: job.job_type,
        status: job.status,
        created_at: job.created_at,
        started_at: job.started_at,
        completed_at: job.completed_at,
        error: job.error.clone(),
        summary,
    }
}
