use crate::{
    AppState,
    auth::context::AuthContext,
    errors::ApiError,
    models::{
        CreateTransactionRequest, TransactionFilter, TransactionResponse, UpdateTransactionRequest,
    },
    services::transaction_service,
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

    transaction_service::delete_transaction(&state.db, id, user_id).await?;

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
