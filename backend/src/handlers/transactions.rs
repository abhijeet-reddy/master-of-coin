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
