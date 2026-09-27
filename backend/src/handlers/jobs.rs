use axum::{
    Json,
    extract::{Extension, Path, Query, State},
};
use uuid::Uuid;

use crate::{
    AppState,
    auth::context::AuthContext,
    errors::ApiError,
    models::job_summary::{
        BackgroundJobDetail, BackgroundJobSummary, ListJobsQuery, parse_job_type,
    },
    repositories::background_job::BackgroundJobRepository,
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

    let summaries: Vec<BackgroundJobSummary> =
        jobs.iter().map(BackgroundJobSummary::from_job).collect();

    Ok(Json(summaries))
}

/// Get one background job with its full input and result.
///
/// Returns 404 when the job does not exist or belongs to another user.
///
/// GET /api/v1/jobs/:id
pub async fn get_job(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(job_id): Path<Uuid>,
) -> Result<Json<BackgroundJobDetail>, ApiError> {
    let user_id = auth_context.user_id();
    let job = BackgroundJobRepository::find_by_id(&state.db, job_id)?
        .filter(|j| j.user_id == user_id)
        .ok_or_else(|| ApiError::NotFound("Job not found".to_string()))?;
    Ok(Json(BackgroundJobDetail::from_job(job)))
}
