use axum::{
    Json,
    extract::{Extension, Path, State},
    http::StatusCode,
};
use uuid::Uuid;
use validator::Validate;

use crate::{
    AppState,
    auth::context::AuthContext,
    errors::ApiError,
    models::{
        background_job::NewBackgroundJob,
        bulk_sync::{
            BulkSyncJobResponse, BulkSyncReport, BulkSyncRequest, StartSyncJobResponse, SyncAction,
            SyncItem,
        },
    },
    repositories::background_job::BackgroundJobRepository,
    types::{JobStatus, JobType},
};

/// Start a new bulk sync job.
///
/// Validates the request, creates a PENDING background job row, and returns
/// 202 Accepted with the job ID. The worker binary picks up the job and
/// processes each sync item sequentially.
///
/// POST /api/v1/sync
pub async fn start_bulk_sync(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Json(body): Json<BulkSyncRequest>,
) -> Result<(StatusCode, Json<StartSyncJobResponse>), ApiError> {
    let user_id = auth_context.user_id();

    // Validate the request body (items not empty via Validate derive)
    body.validate()
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    // Validate each item has the correct fields for its action
    for (i, item) in body.items.iter().enumerate() {
        match item.action {
            SyncAction::Push => {
                if item.transaction_id.is_none() {
                    return Err(ApiError::BadRequest(format!(
                        "Item {}: push action requires transaction_id",
                        i
                    )));
                }
            }
            SyncAction::Pull => {
                if item.external_expense_id.is_none() {
                    return Err(ApiError::BadRequest(format!(
                        "Item {}: pull action requires external_expense_id",
                        i
                    )));
                }
            }
        }
    }

    tracing::info!(
        "Starting bulk sync job for user {} with {} items",
        user_id,
        body.items.len(),
    );

    let total_items = body.items.len();

    let input = serde_json::to_value(&body).map_err(|e| {
        tracing::error!("Failed to serialize bulk sync input: {}", e);
        ApiError::Internal
    })?;

    let new_job = NewBackgroundJob {
        user_id,
        job_type: JobType::BulkSync,
        status: JobStatus::Pending,
        previous_job_id: None,
        input: Some(input),
    };

    let job = BackgroundJobRepository::create_job(&state.db, new_job)?;

    Ok((
        StatusCode::ACCEPTED,
        Json(StartSyncJobResponse {
            job_id: job.id,
            status: JobStatus::Pending,
            message: "Bulk sync job started".to_string(),
            total_items,
        }),
    ))
}

/// Get the status and result of a bulk sync job.
///
/// Returns 404 if the job doesn't exist, belongs to another user, or is not
/// a bulk sync job (security: don't reveal existence of other users' jobs).
///
/// GET /api/v1/sync/:job_id
pub async fn get_bulk_sync(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(job_id): Path<Uuid>,
) -> Result<Json<BulkSyncJobResponse>, ApiError> {
    let user_id = auth_context.user_id();

    tracing::debug!("Fetching bulk sync job {} for user {}", job_id, user_id);

    let job = BackgroundJobRepository::find_by_id(&state.db, job_id)?
        .ok_or_else(|| ApiError::NotFound("Job not found".to_string()))?;

    // Security: don't reveal existence of other users' jobs
    if job.user_id != user_id {
        return Err(ApiError::NotFound("Job not found".to_string()));
    }

    // Only return bulk sync jobs via this endpoint
    if job.job_type != JobType::BulkSync {
        return Err(ApiError::NotFound("Job not found".to_string()));
    }

    // Deserialize result JSONB into BulkSyncReport if status is COMPLETED and result exists
    let result = if job.status == JobStatus::Completed {
        job.result
            .as_ref()
            .map(|r| {
                serde_json::from_value::<BulkSyncReport>(r.clone()).map_err(|e| {
                    tracing::error!(
                        "Failed to deserialize bulk sync report for job {}: {}",
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

    Ok(Json(BulkSyncJobResponse {
        job_id: job.id,
        status: job.status,
        created_at: job.created_at,
        started_at: job.started_at,
        completed_at: job.completed_at,
        result,
        error: job.error,
    }))
}

/// Retry failed items from a completed bulk sync job.
///
/// Creates a new PENDING job containing only the items that failed in the
/// original job. The new job references the original via `previous_job_id`.
///
/// Unlike drift detection retry (which retries FAILED jobs), bulk sync retry
/// works on COMPLETED jobs — because the job itself completed successfully,
/// but individual items within it may have failed.
///
/// POST /api/v1/sync/:job_id/retry
pub async fn retry_bulk_sync(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(job_id): Path<Uuid>,
) -> Result<(StatusCode, Json<StartSyncJobResponse>), ApiError> {
    let user_id = auth_context.user_id();

    tracing::info!("Retrying bulk sync job {} for user {}", job_id, user_id);

    let original_job = BackgroundJobRepository::find_by_id(&state.db, job_id)?
        .ok_or_else(|| ApiError::NotFound("Job not found".to_string()))?;

    // Security: don't reveal existence of other users' jobs
    if original_job.user_id != user_id {
        return Err(ApiError::NotFound("Job not found".to_string()));
    }

    // Only allow retrying bulk sync jobs
    if original_job.job_type != JobType::BulkSync {
        return Err(ApiError::NotFound("Job not found".to_string()));
    }

    // Only COMPLETED jobs can be retried (individual items may have failed)
    if original_job.status != JobStatus::Completed {
        return Err(ApiError::BadRequest(
            "Only COMPLETED jobs can be retried".to_string(),
        ));
    }

    // Deserialize the result to extract failed items
    let report = original_job
        .result
        .as_ref()
        .ok_or_else(|| {
            tracing::error!("Completed job {} has no result", job_id);
            ApiError::Internal
        })
        .and_then(|r| {
            serde_json::from_value::<BulkSyncReport>(r.clone()).map_err(|e| {
                tracing::error!(
                    "Failed to deserialize bulk sync report for job {}: {}",
                    job_id,
                    e
                );
                ApiError::Internal
            })
        })?;

    // Extract failed items and reconstruct SyncItem objects
    let failed_items: Vec<SyncItem> = report
        .items
        .iter()
        .filter(|item| item.status == "failed")
        .map(|item| SyncItem {
            action: item.action.clone(),
            transaction_id: item.transaction_id,
            external_expense_id: item.external_expense_id.clone(),
            provider_type: item.provider_type.clone(),
        })
        .collect();

    if failed_items.is_empty() {
        return Err(ApiError::BadRequest("No failed items to retry".to_string()));
    }

    let total_items = failed_items.len();

    let retry_request = BulkSyncRequest {
        items: failed_items,
    };

    let input = serde_json::to_value(&retry_request).map_err(|e| {
        tracing::error!("Failed to serialize bulk sync retry input: {}", e);
        ApiError::Internal
    })?;

    let new_job = NewBackgroundJob {
        user_id,
        job_type: JobType::BulkSync,
        status: JobStatus::Pending,
        previous_job_id: Some(original_job.id),
        input: Some(input),
    };

    let job = BackgroundJobRepository::create_job(&state.db, new_job)?;

    Ok((
        StatusCode::ACCEPTED,
        Json(StartSyncJobResponse {
            job_id: job.id,
            status: JobStatus::Pending,
            message: "Bulk sync retry job started".to_string(),
            total_items,
        }),
    ))
}
