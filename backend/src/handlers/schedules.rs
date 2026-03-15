use axum::{
    Json,
    extract::{Extension, Path, State},
    http::StatusCode,
};
use chrono::Utc;
use uuid::Uuid;

use crate::{
    AppState,
    auth::context::AuthContext,
    errors::ApiError,
    models::{
        background_job::BackgroundJob,
        job_summary::BackgroundJobSummary,
        schedule::{
            CreateScheduleRequest, NewSchedule, ScheduleDetailResponse, ScheduleResponse,
            UpdateSchedule, UpdateScheduleRequest,
        },
    },
    repositories::schedule::ScheduleRepository,
    types::JobType,
    utils::cron::{compute_next_run, compute_upcoming_runs, validate_cron, validate_min_frequency},
};

/// Parse a job_type string (e.g. `"DRIFT_DETECTION"`) into a [`JobType`] enum variant.
fn parse_job_type(s: &str) -> Result<JobType, ApiError> {
    match s {
        "DRIFT_DETECTION" => Ok(JobType::DriftDetection),
        "BULK_SYNC" => Ok(JobType::BulkSync),
        "PORTFOLIO_SYNC" => Ok(JobType::PortfolioSync),
        _ => Err(ApiError::BadRequest(format!("Invalid job type: {}", s))),
    }
}

/// Convert a [`BackgroundJob`] into a lightweight [`BackgroundJobSummary`].
fn job_to_summary(job: &BackgroundJob) -> BackgroundJobSummary {
    // Extract a summary sub-object from the result JSONB if present
    let summary = job.result.as_ref().and_then(|r| r.get("summary").cloned());

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

/// Create a new schedule.
///
/// Validates the cron expression and minimum frequency, parses the job type,
/// computes the initial `next_run_at`, and inserts the schedule.
///
/// POST /api/v1/schedules
pub async fn create_schedule(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Json(body): Json<CreateScheduleRequest>,
) -> Result<(StatusCode, Json<ScheduleResponse>), ApiError> {
    let user_id = auth_context.user_id();

    // Validate name is not empty
    if body.name.trim().is_empty() {
        return Err(ApiError::BadRequest("Name is required".to_string()));
    }

    // Validate cron expression
    validate_cron(&body.cron_expr).map_err(|e| ApiError::BadRequest(e))?;

    // Validate minimum frequency (>= 1 hour between runs)
    validate_min_frequency(&body.cron_expr).map_err(|e| ApiError::BadRequest(e))?;

    // Parse job_type string to enum
    let job_type = parse_job_type(&body.job_type)?;

    // Compute initial next_run_at
    let next_run_at = compute_next_run(&body.cron_expr).map_err(|e| ApiError::BadRequest(e))?;

    let new_schedule = NewSchedule {
        user_id,
        name: body.name,
        job_type,
        cron_expr: body.cron_expr,
        parameters: body.parameters,
        is_active: true,
        next_run_at: Some(next_run_at),
    };

    tracing::info!(
        "Creating schedule '{}' for user {} (job_type={:?}, next_run_at={})",
        new_schedule.name,
        user_id,
        new_schedule.job_type,
        next_run_at,
    );

    let schedule = ScheduleRepository::create(&state.db, new_schedule)?;
    let response = ScheduleResponse::from_schedule(&schedule);

    Ok((StatusCode::CREATED, Json(response)))
}

/// List all schedules for the current user.
///
/// GET /api/v1/schedules
pub async fn list_schedules(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
) -> Result<Json<Vec<ScheduleResponse>>, ApiError> {
    let user_id = auth_context.user_id();

    let schedules = ScheduleRepository::list_by_user(&state.db, user_id)?;

    let responses: Vec<ScheduleResponse> = schedules
        .iter()
        .map(ScheduleResponse::from_schedule)
        .collect();

    Ok(Json(responses))
}

/// Get schedule details including recent jobs and upcoming runs.
///
/// Returns 404 if the schedule doesn't exist or belongs to another user.
///
/// GET /api/v1/schedules/:id
pub async fn get_schedule(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(schedule_id): Path<Uuid>,
) -> Result<Json<ScheduleDetailResponse>, ApiError> {
    let user_id = auth_context.user_id();

    let schedule = ScheduleRepository::find_by_id(&state.db, schedule_id)?
        .ok_or_else(|| ApiError::NotFound("Schedule not found".to_string()))?;

    // Validate ownership (return 404 for security)
    if schedule.user_id != user_id {
        return Err(ApiError::NotFound("Schedule not found".to_string()));
    }

    // Query recent jobs triggered by this schedule
    let recent_jobs_raw = ScheduleRepository::find_jobs_by_schedule(&state.db, schedule_id, 20)?;

    let recent_jobs: Vec<BackgroundJobSummary> =
        recent_jobs_raw.iter().map(job_to_summary).collect();

    // Compute upcoming runs from the cron expression
    let upcoming_runs = compute_upcoming_runs(&schedule.cron_expr, 10).unwrap_or_default();

    let response = ScheduleDetailResponse {
        schedule: ScheduleResponse::from_schedule(&schedule),
        recent_jobs,
        upcoming_runs,
    };

    Ok(Json(response))
}

/// Update a schedule (partial update).
///
/// If `cron_expr` changes, validates the new expression and recomputes `next_run_at`.
/// Returns 404 if the schedule doesn't exist or belongs to another user.
///
/// PUT /api/v1/schedules/:id
pub async fn update_schedule(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(schedule_id): Path<Uuid>,
    Json(body): Json<UpdateScheduleRequest>,
) -> Result<Json<ScheduleResponse>, ApiError> {
    let user_id = auth_context.user_id();

    let schedule = ScheduleRepository::find_by_id(&state.db, schedule_id)?
        .ok_or_else(|| ApiError::NotFound("Schedule not found".to_string()))?;

    // Validate ownership (return 404 for security)
    if schedule.user_id != user_id {
        return Err(ApiError::NotFound("Schedule not found".to_string()));
    }

    // Validate name if provided
    if let Some(ref name) = body.name {
        if name.trim().is_empty() {
            return Err(ApiError::BadRequest("Name is required".to_string()));
        }
    }

    // If cron_expr is changing, validate and recompute next_run_at
    let mut new_next_run_at: Option<Option<chrono::DateTime<Utc>>> = None;
    if let Some(ref cron_expr) = body.cron_expr {
        validate_cron(cron_expr).map_err(|e| ApiError::BadRequest(e))?;
        validate_min_frequency(cron_expr).map_err(|e| ApiError::BadRequest(e))?;

        let next_run = compute_next_run(cron_expr).map_err(|e| ApiError::BadRequest(e))?;
        new_next_run_at = Some(Some(next_run));
    }

    let changeset = UpdateSchedule {
        name: body.name,
        cron_expr: body.cron_expr,
        parameters: body.parameters.map(Some),
        is_active: body.is_active,
        next_run_at: new_next_run_at,
        updated_at: Some(Utc::now()),
    };

    tracing::info!("Updating schedule {} for user {}", schedule_id, user_id);

    let updated = ScheduleRepository::update(&state.db, schedule_id, changeset)?;
    let response = ScheduleResponse::from_schedule(&updated);

    Ok(Json(response))
}

/// Delete a schedule.
///
/// Returns 404 if the schedule doesn't exist or belongs to another user.
/// Jobs already created by this schedule are NOT deleted.
///
/// DELETE /api/v1/schedules/:id
pub async fn delete_schedule(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(schedule_id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    let user_id = auth_context.user_id();

    let schedule = ScheduleRepository::find_by_id(&state.db, schedule_id)?
        .ok_or_else(|| ApiError::NotFound("Schedule not found".to_string()))?;

    // Validate ownership (return 404 for security)
    if schedule.user_id != user_id {
        return Err(ApiError::NotFound("Schedule not found".to_string()));
    }

    tracing::info!("Deleting schedule {} for user {}", schedule_id, user_id);

    ScheduleRepository::delete(&state.db, schedule_id)?;

    Ok(StatusCode::NO_CONTENT)
}
