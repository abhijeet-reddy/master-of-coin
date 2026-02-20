use crate::{
    AppState,
    auth::context::AuthContext,
    errors::ApiError,
    models::split_sync_record::{
        ResolveMismatchRequest, SplitSyncStatusResponse, SyncExternalExpenseRequest,
    },
    repositories,
    repositories::split_sync_record::SplitSyncRecordRepository,
};
use axum::{
    Json,
    extract::{Extension, Path, State},
};
use uuid::Uuid;

/// Get sync status for a transaction split
/// GET /splits/:id/sync-status
pub async fn get_sync_status(
    State(state): State<AppState>,
    Extension(_auth_context): Extension<AuthContext>,
    Path(split_id): Path<Uuid>,
) -> Result<Json<Vec<SplitSyncStatusResponse>>, ApiError> {
    tracing::debug!("Fetching sync status for split {}", split_id);

    let records = SplitSyncRecordRepository::find_by_split_id(&state.db, split_id)?;

    let responses: Vec<SplitSyncStatusResponse> = records
        .into_iter()
        .map(|record| {
            let status = record.status();
            let external_url = record
                .external_expense_id
                .as_ref()
                .map(|id| format!("https://www.splitwise.com/expenses/{}", id));

            SplitSyncStatusResponse {
                id: record.id,
                transaction_split_id: record.transaction_split_id,
                split_provider_id: record.split_provider_id,
                provider_type: String::new(),
                external_expense_id: record.external_expense_id,
                sync_status: status,
                last_sync_at: record.last_sync_at,
                last_error: record.last_error,
                retry_count: record.retry_count,
                external_url,
            }
        })
        .collect();

    Ok(Json(responses))
}

/// Retry a failed sync for a transaction split
/// POST /splits/:id/retry-sync
pub async fn retry_sync(
    State(state): State<AppState>,
    Extension(_auth_context): Extension<AuthContext>,
    Path(sync_record_id): Path<Uuid>,
) -> Result<Json<SplitSyncStatusResponse>, ApiError> {
    tracing::info!("Retrying sync for record {}", sync_record_id);

    let sync_service = state
        .split_sync
        .as_ref()
        .ok_or_else(|| ApiError::Configuration("Split sync service not configured".to_string()))?;

    let record = sync_service.retry_failed_sync(sync_record_id).await?;

    let status = record.status();
    let external_url = record
        .external_expense_id
        .as_ref()
        .map(|id| format!("https://www.splitwise.com/expenses/{}", id));

    let response = SplitSyncStatusResponse {
        id: record.id,
        transaction_split_id: record.transaction_split_id,
        split_provider_id: record.split_provider_id,
        provider_type: String::new(),
        external_expense_id: record.external_expense_id,
        sync_status: status,
        last_sync_at: record.last_sync_at,
        last_error: record.last_error,
        retry_count: record.retry_count,
        external_url,
    };

    Ok(Json(response))
}

/// Sync a transaction's splits with the external split provider.
///
/// Single entry point for syncing. Flow:
/// 1. If already linked to an external expense → fetch it and compare splits
///    - If splits match → "synced" (already in sync)
///    - If splits differ → "mismatch" (returns both sides' details)
/// 2. If not linked → search provider for matching expenses (same amount, ±3 days)
///    - If exact match found → "linked" (auto-links)
///    - If amount matches but splits differ → "mismatch"
///    - If no match → "created" (creates new expense)
///
/// POST /transactions/:id/sync-split
pub async fn sync_split(
    State(state): State<AppState>,
    Extension(_auth_context): Extension<AuthContext>,
    Path(transaction_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, ApiError> {
    tracing::info!("Syncing split for transaction {}", transaction_id);

    let sync_service = state
        .split_sync
        .as_ref()
        .ok_or_else(|| ApiError::Configuration("Split sync service not configured".to_string()))?;

    let result = sync_service.sync_transaction(transaction_id).await?;

    Ok(Json(result))
}

/// Import a Splitwise expense where someone else paid as a "paid by others" debt transaction.
///
/// Fetches the expense from Splitwise, detects who paid, and creates a local DEBT
/// account transaction with debt_transaction_metadata linking to the payer.
///
/// Idempotent: if the expense is already linked, returns "already_linked".
///
/// POST /integrations/splitwise/sync-external-expense
pub async fn sync_external_expense(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Json(body): Json<SyncExternalExpenseRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!(
        "Syncing external expense {} for user {}",
        body.external_expense_id,
        user_id
    );

    let sync_service = state
        .split_sync
        .as_ref()
        .ok_or_else(|| ApiError::Configuration("Split sync service not configured".to_string()))?;

    // Get the user's Splitwise provider
    let provider =
        repositories::split_provider::find_by_user_and_type(&state.db, user_id, "splitwise")
            .await?
            .ok_or_else(|| ApiError::NotFound("Splitwise not connected".to_string()))?;

    if !provider.is_active {
        return Err(ApiError::BadRequest(
            "Splitwise provider is inactive. Please reconnect.".to_string(),
        ));
    }

    // Fetch the expense from Splitwise
    let expense = sync_service
        .fetch_linked_expense(provider.id, &body.external_expense_id)
        .await?
        .ok_or_else(|| {
            ApiError::NotFound(format!(
                "Expense {} not found on Splitwise",
                body.external_expense_id
            ))
        })?;

    // Import the expense as a debt transaction
    let result = sync_service
        .sync_external_expense(user_id, &expense, provider.id)
        .await?;

    Ok(Json(result))
}

/// Resolve a split mismatch by pushing local data to provider or pulling provider data locally.
///
/// POST /transactions/:id/resolve-split-mismatch
pub async fn resolve_split_mismatch(
    State(state): State<AppState>,
    Extension(_auth_context): Extension<AuthContext>,
    Path(transaction_id): Path<Uuid>,
    Json(body): Json<ResolveMismatchRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    tracing::info!(
        "Resolving split mismatch for transaction {} with action: {}",
        transaction_id,
        body.action
    );

    let sync_service = state
        .split_sync
        .as_ref()
        .ok_or_else(|| ApiError::Configuration("Split sync service not configured".to_string()))?;

    let result = sync_service
        .resolve_mismatch(transaction_id, &body.external_expense_id, &body.action)
        .await?;

    Ok(Json(result))
}
