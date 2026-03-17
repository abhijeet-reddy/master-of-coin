use crate::{
    AppState,
    auth::context::AuthContext,
    errors::ApiError,
    models::{
        CreateTransactionRequest, DeleteTransactionQuery, TransactionFilter, TransactionResponse,
        UpdateTransactionRequest,
    },
    services::{split_sync_service::SplitSyncService, transaction_service},
};
use axum::{
    Json,
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
};
use uuid::Uuid;

/// List transactions with optional filters
/// GET /transactions
pub async fn list(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Query(filters): Query<TransactionFilter>,
) -> Result<Json<Vec<TransactionResponse>>, ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!("Listing transactions for user {}", user_id);

    let transactions = transaction_service::list_transactions(&state.db, user_id, filters).await?;

    Ok(Json(transactions))
}

/// Create a new transaction
/// POST /transactions
pub async fn create(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Json(request): Json<CreateTransactionRequest>,
) -> Result<(StatusCode, Json<TransactionResponse>), ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!("Creating transaction for user {}", user_id);

    let transaction = transaction_service::create_transaction(&state.db, user_id, request).await?;

    // Trigger split sync if splits were created (fire-and-forget)
    if let Some(ref splits) = transaction.splits {
        if !splits.is_empty() {
            trigger_split_sync(state.split_sync.clone(), transaction.id).await;
        }
    }

    Ok((StatusCode::CREATED, Json(transaction)))
}

/// Get a single transaction by ID
/// GET /transactions/:id
pub async fn get(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(id): Path<Uuid>,
) -> Result<Json<TransactionResponse>, ApiError> {
    let user_id = auth_context.user_id();
    tracing::debug!("Fetching transaction {} for user {}", id, user_id);

    let transaction = transaction_service::get_transaction(&state.db, id, user_id).await?;

    Ok(Json(transaction))
}

/// Update a transaction
/// PUT /transactions/:id
pub async fn update(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateTransactionRequest>,
) -> Result<Json<TransactionResponse>, ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!("Updating transaction {} for user {}", id, user_id);

    let transaction =
        transaction_service::update_transaction(&state.db, id, user_id, request).await?;

    // On update: if already linked → push updated splits to provider; if not → regular sync
    trigger_split_sync_on_update(state.split_sync.clone(), transaction.id).await;

    Ok(Json(transaction))
}

/// Delete a transaction (soft-delete by default, permanent with `?is_permanent=true`)
/// DELETE /transactions/:id
/// DELETE /transactions/:id?is_permanent=true
pub async fn delete(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(id): Path<Uuid>,
    Query(query): Query<DeleteTransactionQuery>,
) -> Result<impl IntoResponse, ApiError> {
    let user_id = auth_context.user_id();

    if query.is_permanent == Some(true) {
        tracing::info!(
            "Permanently deleting transaction {} for user {}",
            id,
            user_id
        );

        // Get splits before deletion so we can notify sync service
        let existing = transaction_service::get_transaction(&state.db, id, user_id).await?;
        let split_ids: Vec<Uuid> = existing
            .splits
            .as_ref()
            .map(|s| s.iter().map(|split| split.id).collect())
            .unwrap_or_default();

        transaction_service::permanent_delete_transaction(&state.db, id, user_id).await?;

        // Trigger split sync deletion for each split (fire-and-forget)
        for split_id in split_ids {
            trigger_split_sync_deleted(state.split_sync.clone(), id, split_id).await;
        }

        Ok(StatusCode::NO_CONTENT.into_response())
    } else {
        tracing::info!("Soft-deleting transaction {} for user {}", id, user_id);

        // Get splits before soft-deletion so we can notify sync service
        let existing = transaction_service::get_transaction(&state.db, id, user_id).await?;
        let split_ids: Vec<Uuid> = existing
            .splits
            .as_ref()
            .map(|s| s.iter().map(|split| split.id).collect())
            .unwrap_or_default();

        let response = transaction_service::delete_transaction(&state.db, id, user_id).await?;

        // Trigger split sync deletion for each split (fire-and-forget)
        for split_id in split_ids {
            trigger_split_sync_deleted(state.split_sync.clone(), id, split_id).await;
        }

        Ok((StatusCode::OK, Json(response)).into_response())
    }
}

/// Restore a soft-deleted transaction from trash
/// POST /transactions/:id/restore
pub async fn restore(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(id): Path<Uuid>,
) -> Result<(StatusCode, Json<TransactionResponse>), ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!("Restoring transaction {} for user {}", id, user_id);

    let response = transaction_service::restore_transaction(&state.db, id, user_id).await?;

    Ok((StatusCode::OK, Json(response)))
}

/// Bulk create transactions using a single multi-row INSERT.
///
/// POST /transactions/bulk-create
///
/// Validates all transactions upfront, verifies ownership in batch,
/// then inserts all rows in a single atomic SQL statement.
pub async fn bulk_create(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Json(request): Json<crate::models::BulkCreateRequest>,
) -> Result<Json<crate::models::BulkCreateResponse>, ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!(
        "Bulk creating {} transactions for user {}",
        request.transactions.len(),
        user_id
    );

    // Verify account belongs to user
    crate::services::account_service::get_account(&state.db, request.account_id, user_id).await?;

    // Use bulk insert service — single multi-row INSERT, atomic
    let created_transactions = transaction_service::bulk_create_transactions(
        &state.db,
        user_id,
        request.account_id,
        request.transactions,
    )
    .await?;

    let count = created_transactions.len();

    Ok(Json(crate::models::BulkCreateResponse {
        success: true,
        data: crate::models::BulkCreateData {
            created: count,
            failed: 0,
            transactions: created_transactions,
            errors: None,
        },
    }))
}

// --- Split Sync Helper Functions ---
// These are fire-and-forget: sync failures never block transaction operations.

/// Trigger split sync for a transaction (create, update, or re-sync).
///
/// Uses `sync_transaction()` which:
/// 1. If already linked → fetches the linked expense and compares
/// 2. If not linked → searches for matching expenses
/// 3. Links, creates, or reports mismatch as needed
async fn trigger_split_sync(sync_service: Option<SplitSyncService>, transaction_id: Uuid) {
    if let Some(service) = sync_service {
        match service.sync_transaction(transaction_id).await {
            Ok(result) => {
                let status = result
                    .get("status")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown");
                tracing::info!("Split sync for transaction {}: {}", transaction_id, status);
            }
            Err(e) => {
                tracing::warn!(
                    "Split sync failed for transaction {}: {}",
                    transaction_id,
                    e
                );
            }
        }
    }
}

/// Trigger sync on transaction update.
///
/// If already linked to an external expense → pushes updated local splits.
/// If not linked → runs regular sync logic (search, link, or create).
async fn trigger_split_sync_on_update(
    sync_service: Option<SplitSyncService>,
    transaction_id: Uuid,
) {
    if let Some(service) = sync_service {
        match service.sync_on_update(transaction_id).await {
            Ok(result) => {
                let status = result
                    .get("status")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown");
                tracing::info!(
                    "Split sync on update for transaction {}: {}",
                    transaction_id,
                    status
                );
            }
            Err(e) => {
                tracing::warn!(
                    "Split sync failed on update for transaction {}: {}",
                    transaction_id,
                    e
                );
            }
        }
    }
}

/// Trigger sync cleanup after a split is deleted.
///
/// Keeps `on_split_deleted` since we need to delete/update the external expense.
async fn trigger_split_sync_deleted(
    sync_service: Option<SplitSyncService>,
    transaction_id: Uuid,
    split_id: Uuid,
) {
    if let Some(service) = sync_service {
        if let Err(e) = service.on_split_deleted(transaction_id, split_id).await {
            tracing::warn!(
                "Split sync failed after deleting split {} from transaction {}: {}",
                split_id,
                transaction_id,
                e
            );
        }
    }
}
