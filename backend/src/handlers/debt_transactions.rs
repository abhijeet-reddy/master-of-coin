//! HTTP handlers for debt transaction endpoints.

use crate::{
    AppState,
    auth::context::AuthContext,
    errors::ApiError,
    models::{CreateDebtTransactionRequest, TransactionResponse},
    services::debt_transaction_service,
};
use axum::{
    Json,
    extract::{Extension, State},
    http::StatusCode,
};

/// Create a "paid by others" (debt) transaction.
/// POST /api/v1/debt-transactions
pub async fn create(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Json(request): Json<CreateDebtTransactionRequest>,
) -> Result<(StatusCode, Json<TransactionResponse>), ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!("Creating debt transaction for user {}", user_id);

    let response =
        debt_transaction_service::create_debt_transaction(&state.db, user_id, request).await?;

    Ok((StatusCode::CREATED, Json(response)))
}
