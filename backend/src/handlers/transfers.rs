use crate::{
    AppState,
    auth::context::AuthContext,
    errors::ApiError,
    models::transfer::{CreateTransferRequest, TransferResponse},
    services::transfer_service,
};
use axum::{
    Json,
    extract::{Extension, State},
    http::StatusCode,
};

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
