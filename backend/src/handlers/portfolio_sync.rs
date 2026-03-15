use axum::{
    Json,
    extract::{Extension, Path, State},
    http::StatusCode,
};
use uuid::Uuid;

use crate::{
    AppState,
    auth::context::AuthContext,
    errors::ApiError,
    models::{
        background_job::NewBackgroundJob,
        portfolio_sync::{
            PortfolioSyncJobResponse, PortfolioSyncReport, PortfolioSyncRequest,
            StartPortfolioSyncResponse,
        },
    },
    repositories::background_job::BackgroundJobRepository,
    types::{JobStatus, JobType},
};

/// Start a new portfolio sync job.
///
/// Creates a PENDING background job row. The worker binary picks it up
/// and executes the actual portfolio sync logic.
///
/// POST /api/v1/portfolio-sync
pub async fn start_portfolio_sync(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Json(body): Json<PortfolioSyncRequest>,
) -> Result<(StatusCode, Json<StartPortfolioSyncResponse>), ApiError> {
    let user_id = auth_context.user_id();

    tracing::info!(
        "Starting portfolio sync job for user {} (account: {:?})",
        user_id,
        body.account_id,
    );

    let input = serde_json::to_value(&body).map_err(|e| {
        tracing::error!("Failed to serialize portfolio sync input: {}", e);
        ApiError::Internal
    })?;

    let new_job = NewBackgroundJob {
        user_id,
        job_type: JobType::PortfolioSync,
        status: JobStatus::Pending,
        previous_job_id: None,
        input: Some(input),
    };

    let job = BackgroundJobRepository::create_job(&state.db, new_job)?;

    Ok((
        StatusCode::ACCEPTED,
        Json(StartPortfolioSyncResponse {
            job_id: job.id,
            status: JobStatus::Pending,
            message: "Portfolio sync job started".to_string(),
        }),
    ))
}

/// Get the status and result of a portfolio sync job.
///
/// Returns 404 if the job doesn't exist, belongs to another user, or is not
/// a portfolio sync job.
///
/// GET /api/v1/portfolio-sync/:job_id
pub async fn get_portfolio_sync(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(job_id): Path<Uuid>,
) -> Result<Json<PortfolioSyncJobResponse>, ApiError> {
    let user_id = auth_context.user_id();

    tracing::debug!(
        "Fetching portfolio sync job {} for user {}",
        job_id,
        user_id
    );

    let job = BackgroundJobRepository::find_by_id(&state.db, job_id)?
        .ok_or_else(|| ApiError::NotFound("Job not found".to_string()))?;

    // Security: don't reveal existence of other users' jobs
    if job.user_id != user_id {
        return Err(ApiError::NotFound("Job not found".to_string()));
    }

    // Only return portfolio sync jobs via this endpoint
    if job.job_type != JobType::PortfolioSync {
        return Err(ApiError::NotFound("Job not found".to_string()));
    }

    // Deserialize result JSONB into PortfolioSyncReport if status is COMPLETED
    let result = if job.status == JobStatus::Completed {
        job.result
            .as_ref()
            .map(|r| {
                serde_json::from_value::<PortfolioSyncReport>(r.clone()).map_err(|e| {
                    tracing::error!(
                        "Failed to deserialize portfolio sync report for job {}: {}",
                        job_id,
                        e
                    );
                    ApiError::Internal
                })
            })
            .transpose()?
    } else {
        None
    };

    Ok(Json(PortfolioSyncJobResponse {
        job_id: job.id,
        status: job.status,
        created_at: job.created_at,
        started_at: job.started_at,
        completed_at: job.completed_at,
        result,
        error: job.error,
    }))
}

/// Retry a failed portfolio sync job.
///
/// Creates a new PENDING job with the same input and a reference to the original
/// job via `previous_job_id`. Only FAILED jobs can be retried.
///
/// POST /api/v1/portfolio-sync/:job_id/retry
pub async fn retry_portfolio_sync(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(job_id): Path<Uuid>,
) -> Result<(StatusCode, Json<StartPortfolioSyncResponse>), ApiError> {
    let user_id = auth_context.user_id();

    tracing::info!(
        "Retrying portfolio sync job {} for user {}",
        job_id,
        user_id
    );

    let original_job = BackgroundJobRepository::find_by_id(&state.db, job_id)?
        .ok_or_else(|| ApiError::NotFound("Job not found".to_string()))?;

    // Security: don't reveal existence of other users' jobs
    if original_job.user_id != user_id {
        return Err(ApiError::NotFound("Job not found".to_string()));
    }

    // Only allow retrying portfolio sync jobs
    if original_job.job_type != JobType::PortfolioSync {
        return Err(ApiError::NotFound("Job not found".to_string()));
    }

    // Only FAILED jobs can be retried
    if original_job.status != JobStatus::Failed {
        return Err(ApiError::BadRequest(
            "Only FAILED jobs can be retried".to_string(),
        ));
    }

    let new_job = NewBackgroundJob {
        user_id,
        job_type: JobType::PortfolioSync,
        status: JobStatus::Pending,
        previous_job_id: Some(original_job.id),
        input: original_job.input,
    };

    let job = BackgroundJobRepository::create_job(&state.db, new_job)?;

    Ok((
        StatusCode::ACCEPTED,
        Json(StartPortfolioSyncResponse {
            job_id: job.id,
            status: JobStatus::Pending,
            message: "Portfolio sync job started".to_string(),
        }),
    ))
}
