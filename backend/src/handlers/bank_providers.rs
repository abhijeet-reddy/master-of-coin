use axum::{
    Json,
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Redirect, Response},
};
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    AppState,
    auth::context::AuthContext,
    errors::ApiError,
    models::{
        background_job::NewBackgroundJob,
        bank_provider::{
            BankAuthUrlResponse, BankProviderResponse, BankSyncImportRequest, BankSyncRequest,
            ExternalBankAccountResponse, LinkExternalAccountRequest, NewBankProvider,
        },
        bank_sync::{BankSyncJobResponse, BankSyncReport, StartBankSyncResponse},
    },
    repositories,
    services::bank_sync_service,
    types::{BankProviderType, JobStatus, JobType},
    utils,
};

/// OAuth callback query parameters
#[derive(Debug, Deserialize)]
pub struct BankOAuthCallbackQuery {
    pub code: String,
    pub state: String,
}

/// Query params for auth-url
#[derive(Debug, Deserialize)]
pub struct AuthUrlQuery {
    pub account_id: Uuid,
}

/// List all bank provider connections for the current user.
///
/// GET /api/v1/bank-providers
pub async fn list_bank_providers(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
) -> Result<Json<Vec<BankProviderResponse>>, ApiError> {
    let user_id = auth_context.user_id();
    let providers = repositories::bank_provider::list_by_user(&state.db, user_id).await?;
    let responses: Vec<BankProviderResponse> = providers.into_iter().map(|p| p.into()).collect();
    Ok(Json(responses))
}

/// Get TrueLayer OAuth authorization URL.
///
/// GET /api/v1/bank-providers/truelayer/auth-url?account_id=XXX
pub async fn get_truelayer_auth_url(
    State(_state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Query(query): Query<AuthUrlQuery>,
) -> Result<Json<BankAuthUrlResponse>, ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!(
        "Generating TrueLayer auth URL for user {} account {}",
        user_id,
        query.account_id
    );

    let (auth_url, state_str) = bank_sync_service::generate_auth_url(user_id, query.account_id)?;

    Ok(Json(BankAuthUrlResponse {
        auth_url,
        state: state_str,
    }))
}

/// Handle TrueLayer OAuth callback (PUBLIC endpoint - no auth required).
///
/// GET /api/v1/bank-providers/truelayer/callback?code=XXX&state=YYY
pub async fn truelayer_oauth_callback(
    State(state): State<AppState>,
    Query(query): Query<BankOAuthCallbackQuery>,
) -> Result<Response, ApiError> {
    tracing::info!("TrueLayer OAuth callback received");

    // Verify and extract user_id + account_id from encrypted state
    let (user_id, account_id) = utils::verify_bank_oauth_state(&query.state).map_err(|e| {
        tracing::error!("Invalid OAuth state: {}", e);
        ApiError::BadRequest(format!("Invalid OAuth state: {}", e))
    })?;

    tracing::info!("OAuth callback for user {} account {}", user_id, account_id);

    // Delegate to service for token exchange and provider creation
    bank_sync_service::handle_oauth_callback(&state.db, user_id, account_id, &query.code).await?;

    // Redirect to frontend settings page with success
    Ok(Redirect::temporary("/settings?bank_connected=true").into_response())
}

/// Disconnect a bank provider.
///
/// DELETE /api/v1/bank-providers/:id
pub async fn disconnect_bank_provider(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    let user_id = auth_context.user_id();

    let provider = repositories::bank_provider::find_by_id(&state.db, id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Bank provider not found".to_string()))?;

    if provider.user_id != user_id {
        return Err(ApiError::NotFound("Bank provider not found".to_string()));
    }

    repositories::bank_provider::delete(&state.db, id).await?;
    tracing::info!("Bank provider {} disconnected by user {}", id, user_id);

    Ok(StatusCode::NO_CONTENT)
}

/// Start a bank sync job.
///
/// POST /api/v1/bank-providers/:id/sync
pub async fn start_sync(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(id): Path<Uuid>,
    Json(body): Json<BankSyncRequest>,
) -> Result<(StatusCode, Json<StartBankSyncResponse>), ApiError> {
    let user_id = auth_context.user_id();

    // Verify provider exists and belongs to user
    let provider = repositories::bank_provider::find_by_id(&state.db, id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Bank provider not found".to_string()))?;

    if provider.user_id != user_id {
        return Err(ApiError::NotFound("Bank provider not found".to_string()));
    }

    if !provider.is_active {
        return Err(ApiError::BadRequest(
            "Bank provider is not active. Please reconnect.".to_string(),
        ));
    }

    tracing::info!(
        "Starting bank sync job for user {} provider {}",
        user_id,
        id
    );

    let input = serde_json::json!({
        "bank_provider_id": id.to_string(),
        "from_date": body.from_date.map(|d| d.to_rfc3339()),
        "to_date": body.to_date.map(|d| d.to_rfc3339()),
    });

    let new_job = NewBackgroundJob {
        user_id,
        job_type: JobType::BankSync,
        status: JobStatus::Pending,
        previous_job_id: None,
        input: Some(input),
    };

    let job =
        repositories::background_job::BackgroundJobRepository::create_job(&state.db, new_job)?;

    Ok((
        StatusCode::ACCEPTED,
        Json(StartBankSyncResponse {
            job_id: job.id,
            status: JobStatus::Pending,
            message: "Bank sync job started".to_string(),
        }),
    ))
}

/// Get the status and result of a bank sync job.
///
/// GET /api/v1/bank-providers/sync/:job_id
pub async fn get_sync_job(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(job_id): Path<Uuid>,
) -> Result<Json<BankSyncJobResponse>, ApiError> {
    let user_id = auth_context.user_id();

    let job = repositories::background_job::BackgroundJobRepository::find_by_id(&state.db, job_id)?
        .ok_or_else(|| ApiError::NotFound("Job not found".to_string()))?;

    if job.user_id != user_id || job.job_type != JobType::BankSync {
        return Err(ApiError::NotFound("Job not found".to_string()));
    }

    // Parse result and re-check already_imported flags live
    let result = bank_sync_service::get_sync_report_with_live_status(&state.db, &job.result).await;

    Ok(Json(BankSyncJobResponse {
        job_id: job.id,
        status: job.status,
        created_at: job.created_at,
        started_at: job.started_at,
        completed_at: job.completed_at,
        result,
        error: job.error,
    }))
}

/// Import selected transactions from a sync job result.
///
/// POST /api/v1/bank-providers/sync/:job_id/import
pub async fn import_transactions(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(job_id): Path<Uuid>,
    Json(body): Json<BankSyncImportRequest>,
) -> Result<Json<crate::models::bank_sync::BankImportResult>, ApiError> {
    let user_id = auth_context.user_id();

    let job = repositories::background_job::BackgroundJobRepository::find_by_id(&state.db, job_id)?
        .ok_or_else(|| ApiError::NotFound("Job not found".to_string()))?;

    if job.user_id != user_id || job.job_type != JobType::BankSync {
        return Err(ApiError::NotFound("Job not found".to_string()));
    }

    if job.status != JobStatus::Completed {
        return Err(ApiError::BadRequest("Job is not completed yet".to_string()));
    }

    let report: BankSyncReport = job
        .result
        .as_ref()
        .ok_or_else(|| ApiError::InternalWithMessage("Job has no result".to_string()))
        .and_then(|r| {
            serde_json::from_value(r.clone()).map_err(|e| {
                ApiError::InternalWithMessage(format!("Failed to parse result: {}", e))
            })
        })?;

    let bank_provider_id = Uuid::parse_str(&report.bank_provider_id).map_err(|_| {
        ApiError::InternalWithMessage("Invalid bank_provider_id in report".to_string())
    })?;

    let provider = repositories::bank_provider::find_by_id(&state.db, bank_provider_id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Bank provider not found".to_string()))?;

    let result = bank_sync_service::import_transactions(
        &state.db,
        user_id,
        bank_provider_id,
        provider.account_id,
        &report,
        &body.transaction_ids,
    )
    .await?;

    tracing::info!(
        "Imported {} transactions, skipped {}, errors: {}",
        result.imported_count,
        result.skipped_count,
        result.errors.len()
    );

    Ok(Json(result))
}

/// Fetch current balance from the bank provider.
///
/// GET /api/v1/bank-providers/:id/balance
pub async fn get_balance(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(id): Path<Uuid>,
) -> Result<Json<crate::models::bank_provider::BankBalanceResponse>, ApiError> {
    let user_id = auth_context.user_id();

    let provider_record = repositories::bank_provider::find_by_id(&state.db, id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Bank provider not found".to_string()))?;

    if provider_record.user_id != user_id {
        return Err(ApiError::NotFound("Bank provider not found".to_string()));
    }

    bank_sync_service::fetch_balance(&state.db, &provider_record).await
}

/// List external bank accounts from the provider (for linking).
///
/// GET /api/v1/bank-providers/:id/accounts
pub async fn list_external_accounts(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<ExternalBankAccountResponse>>, ApiError> {
    let user_id = auth_context.user_id();

    let provider_record = repositories::bank_provider::find_by_id(&state.db, id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Bank provider not found".to_string()))?;

    if provider_record.user_id != user_id {
        return Err(ApiError::NotFound("Bank provider not found".to_string()));
    }

    bank_sync_service::fetch_external_accounts(&provider_record).await
}

/// Link a specific external bank account to this provider.
///
/// PUT /api/v1/bank-providers/:id/link-account
pub async fn link_external_account(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(id): Path<Uuid>,
    Json(body): Json<LinkExternalAccountRequest>,
) -> Result<Json<BankProviderResponse>, ApiError> {
    let user_id = auth_context.user_id();

    let provider_record = repositories::bank_provider::find_by_id(&state.db, id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Bank provider not found".to_string()))?;

    if provider_record.user_id != user_id {
        return Err(ApiError::NotFound("Bank provider not found".to_string()));
    }

    let updated = repositories::bank_provider::update_external_account_id(
        &state.db,
        id,
        &body.external_account_id,
    )
    .await?;

    tracing::info!(
        "Linked external account {} to bank provider {}",
        body.external_account_id,
        id
    );

    Ok(Json(updated.into()))
}
