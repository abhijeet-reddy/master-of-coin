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
        drift_detection::{
            DriftDetectionJobResponse, DriftDetectionRequest, DriftReport, StartJobResponse,
        },
    },
    repositories::background_job::BackgroundJobRepository,
    types::{JobStatus, JobType},
};

/// Start a new drift detection job.
///
/// Creates a PENDING background job row. The worker binary (Phase 5) picks it up
/// and executes the actual drift detection logic.
///
/// POST /api/v1/drift-detection
pub async fn start_drift_detection(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Json(body): Json<DriftDetectionRequest>,
) -> Result<(StatusCode, Json<StartJobResponse>), ApiError> {
    let user_id = auth_context.user_id();

    tracing::info!(
        "Starting drift detection job for user {} ({} to {})",
        user_id,
        body.start_date,
        body.end_date,
    );

    let input = serde_json::to_value(&body).map_err(|e| {
        tracing::error!("Failed to serialize drift detection input: {}", e);
        ApiError::Internal
    })?;

    let new_job = NewBackgroundJob {
        user_id,
        job_type: JobType::DriftDetection,
        status: JobStatus::Pending,
        previous_job_id: None,
        input: Some(input),
    };

    let job = BackgroundJobRepository::create_job(&state.db, new_job)?;

    Ok((
        StatusCode::ACCEPTED,
        Json(StartJobResponse {
            job_id: job.id,
            status: JobStatus::Pending,
            message: "Drift detection job started".to_string(),
        }),
    ))
}

/// Get the status and result of a drift detection job.
///
/// Returns 404 if the job doesn't exist, belongs to another user, or is not
/// a drift detection job (security: don't reveal existence of other users' jobs).
///
/// GET /api/v1/drift-detection/:job_id
pub async fn get_drift_detection(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(job_id): Path<Uuid>,
) -> Result<Json<DriftDetectionJobResponse>, ApiError> {
    let user_id = auth_context.user_id();

    tracing::debug!(
        "Fetching drift detection job {} for user {}",
        job_id,
        user_id
    );

    let job = BackgroundJobRepository::find_by_id(&state.db, job_id)?
        .ok_or_else(|| ApiError::NotFound("Job not found".to_string()))?;

    // Security: don't reveal existence of other users' jobs
    if job.user_id != user_id {
        return Err(ApiError::NotFound("Job not found".to_string()));
    }

    // Only return drift detection jobs via this endpoint
    if job.job_type != JobType::DriftDetection {
        return Err(ApiError::NotFound("Job not found".to_string()));
    }

    // Deserialize result JSONB into DriftReport if status is COMPLETED and result exists
    let result = if job.status == JobStatus::Completed {
        job.result
            .as_ref()
            .map(|r| {
                serde_json::from_value::<DriftReport>(r.clone()).map_err(|e| {
                    tracing::error!(
                        "Failed to deserialize drift report for job {}: {}",
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

    Ok(Json(DriftDetectionJobResponse {
        job_id: job.id,
        status: job.status,
        created_at: job.created_at,
        started_at: job.started_at,
        completed_at: job.completed_at,
        result,
        error: job.error,
    }))
}

/// Retry a failed drift detection job.
///
/// Creates a new PENDING job with the same input and a reference to the original
/// job via `previous_job_id`. Only FAILED jobs can be retried.
///
/// POST /api/v1/drift-detection/:job_id/retry
pub async fn retry_drift_detection(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(job_id): Path<Uuid>,
) -> Result<(StatusCode, Json<StartJobResponse>), ApiError> {
    let user_id = auth_context.user_id();

    tracing::info!(
        "Retrying drift detection job {} for user {}",
        job_id,
        user_id
    );

    let original_job = BackgroundJobRepository::find_by_id(&state.db, job_id)?
        .ok_or_else(|| ApiError::NotFound("Job not found".to_string()))?;

    // Security: don't reveal existence of other users' jobs
    if original_job.user_id != user_id {
        return Err(ApiError::NotFound("Job not found".to_string()));
    }

    // Only allow retrying drift detection jobs
    if original_job.job_type != JobType::DriftDetection {
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
        job_type: JobType::DriftDetection,
        status: JobStatus::Pending,
        previous_job_id: Some(original_job.id),
        input: original_job.input,
    };

    let job = BackgroundJobRepository::create_job(&state.db, new_job)?;

    Ok((
        StatusCode::ACCEPTED,
        Json(StartJobResponse {
            job_id: job.id,
            status: JobStatus::Pending,
            message: "Drift detection job started".to_string(),
        }),
    ))
}
