use crate::{
    AppState,
    auth::context::AuthContext,
    errors::ApiError,
    models::{
        CreateTransactionRequest, TransactionFilter, TransactionResponse, UpdateTransactionRequest,
    },
    services::{split_sync_service::SplitSyncService, transaction_service},
};
use axum::{
    Json,
    extract::{Extension, Path, Query, State},
    http::StatusCode,
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

    // Trigger split sync if splits were created (fire-and-forget, don't block response)
    if let Some(ref splits) = transaction.splits {
        if !splits.is_empty() {
            let split_ids: Vec<Uuid> = splits.iter().map(|s| s.id).collect();
            let transaction_id = transaction.id;
            trigger_split_sync_created(state.split_sync.clone(), transaction_id, split_ids).await;
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

    // Trigger split sync update for all splits (fire-and-forget)
    if let Some(ref splits) = transaction.splits {
        for split in splits {
            trigger_split_sync_updated(state.split_sync.clone(), split.id).await;
        }
    }

    Ok(Json(transaction))
}

/// Delete a transaction
/// DELETE /transactions/:id
pub async fn delete(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!("Deleting transaction {} for user {}", id, user_id);

    // Get splits before deletion so we can notify sync service
    let existing = transaction_service::get_transaction(&state.db, id, user_id).await?;
    let split_ids: Vec<Uuid> = existing
        .splits
        .as_ref()
        .map(|s| s.iter().map(|split| split.id).collect())
        .unwrap_or_default();

    transaction_service::delete_transaction(&state.db, id, user_id).await?;

    // Trigger split sync deletion for each split (fire-and-forget)
    for split_id in split_ids {
        trigger_split_sync_deleted(state.split_sync.clone(), id, split_id).await;
    }

    Ok(StatusCode::NO_CONTENT)
}

/// Bulk create transactions
/// POST /transactions/bulk-create
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

    let mut created_transactions = Vec::new();
    let mut errors = Vec::new();

    // Create transactions one by one
    for (index, transaction_request) in request.transactions.iter().enumerate() {
        match transaction_service::create_transaction(
            &state.db,
            user_id,
            (*transaction_request).clone(),
        )
        .await
        {
            Ok(transaction) => created_transactions.push(transaction),
            Err(e) => {
                errors.push(crate::models::BulkCreateError {
                    index,
                    error: e.to_string(),
                });
            }
        }
    }

    Ok(Json(crate::models::BulkCreateResponse {
        success: errors.is_empty(),
        data: crate::models::BulkCreateData {
            created: created_transactions.len(),
            failed: errors.len(),
            transactions: created_transactions,
            errors: if errors.is_empty() {
                None
            } else {
                Some(errors)
            },
        },
    }))
}

// --- Split Sync Helper Functions ---
// These are fire-and-forget: sync failures never block transaction operations.

/// Trigger sync after splits are created on a transaction
async fn trigger_split_sync_created(
    sync_service: Option<SplitSyncService>,
    transaction_id: Uuid,
    split_ids: Vec<Uuid>,
) {
    if let Some(service) = sync_service {
        if let Err(e) = service
            .on_transaction_splits_created(transaction_id, split_ids)
            .await
        {
            tracing::warn!(
                "Split sync failed after creating splits for transaction {}: {}",
                transaction_id,
                e
            );
        }
    }
}

/// Trigger sync after a split is updated
async fn trigger_split_sync_updated(sync_service: Option<SplitSyncService>, split_id: Uuid) {
    if let Some(service) = sync_service {
        if let Err(e) = service.on_split_updated(split_id).await {
            tracing::warn!("Split sync failed after updating split {}: {}", split_id, e);
        }
    }
}

/// Trigger sync after a split is deleted
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
