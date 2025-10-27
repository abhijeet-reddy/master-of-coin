use crate::{
    AppState,
    errors::ApiError,
    models::{
        CreateTransactionRequest, TransactionFilter, TransactionResponse, UpdateTransactionRequest,
        User,
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
    Extension(user): Extension<User>,
    Query(filters): Query<TransactionFilter>,
) -> Result<Json<Vec<TransactionResponse>>, ApiError> {
    tracing::info!("Listing transactions for user {}", user.id);

    let transactions = transaction_service::list_transactions(&state.db, user.id, filters).await?;

    Ok(Json(transactions))
}

/// Create a new transaction
/// POST /transactions
pub async fn create(
    State(state): State<AppState>,
    Extension(user): Extension<User>,
    Json(request): Json<CreateTransactionRequest>,
) -> Result<(StatusCode, Json<TransactionResponse>), ApiError> {
    tracing::info!("Creating transaction for user {}", user.id);

    let transaction = transaction_service::create_transaction(&state.db, user.id, request).await?;

    Ok((StatusCode::CREATED, Json(transaction)))
}

/// Get a single transaction by ID
/// GET /transactions/:id
pub async fn get(
    State(state): State<AppState>,
    Extension(user): Extension<User>,
    Path(id): Path<Uuid>,
) -> Result<Json<TransactionResponse>, ApiError> {
    tracing::debug!("Fetching transaction {} for user {}", id, user.id);

    let transaction = transaction_service::get_transaction(&state.db, id, user.id).await?;

    Ok(Json(transaction))
}

/// Update a transaction
/// PUT /transactions/:id
pub async fn update(
    State(state): State<AppState>,
    Extension(user): Extension<User>,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateTransactionRequest>,
) -> Result<Json<TransactionResponse>, ApiError> {
    tracing::info!("Updating transaction {} for user {}", id, user.id);

    let transaction =
        transaction_service::update_transaction(&state.db, id, user.id, request).await?;

    Ok(Json(transaction))
}

/// Delete a transaction
/// DELETE /transactions/:id
pub async fn delete(
    State(state): State<AppState>,
    Extension(user): Extension<User>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    tracing::info!("Deleting transaction {} for user {}", id, user.id);

    transaction_service::delete_transaction(&state.db, id, user.id).await?;

    Ok(StatusCode::NO_CONTENT)
}
