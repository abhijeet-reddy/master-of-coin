use crate::{
    AppState,
    auth::context::AuthContext,
    errors::ApiError,
    models::transfer::{ConvertToTransferRequest, CreateTransferRequest, TransferResponse},
    services::transfer_service,
};
use axum::{
    Json,
    extract::{Extension, Path, State},
    http::StatusCode,
};
use uuid::Uuid;

/// Create a new transfer between two accounts
/// POST /transfers
pub async fn create(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Json(request): Json<CreateTransferRequest>,
) -> Result<(StatusCode, Json<TransferResponse>), ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!("Creating transfer for user {}", user_id);

    let transfer = transfer_service::create_transfer(&state.db, user_id, request).await?;

    Ok((StatusCode::CREATED, Json(transfer)))
}

/// Convert an existing transaction into a transfer
/// POST /transactions/:id/convert-to-transfer
pub async fn convert_to_transfer(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(transaction_id): Path<Uuid>,
    Json(request): Json<ConvertToTransferRequest>,
) -> Result<(StatusCode, Json<TransferResponse>), ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!(
        "Converting transaction {} into a transfer for user {}",
        transaction_id,
        user_id
    );

    let transfer = transfer_service::convert_transaction_to_transfer(
        &state.db,
        user_id,
        transaction_id,
        request,
    )
    .await?;

    Ok((StatusCode::CREATED, Json(transfer)))
}
