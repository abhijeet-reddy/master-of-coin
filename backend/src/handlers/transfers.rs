use crate::{
    AppState,
    auth::context::AuthContext,
    errors::ApiError,
    models::transfer::{
        ConvertToTransferRequest, CreateTransferRequest, TransferCandidate, TransferResponse,
    },
    services::transfer_service,
};
use axum::{
    Json,
    extract::{Extension, Path, Query, State},
    http::StatusCode,
};
use serde::Deserialize;
use uuid::Uuid;

/// Query params for the convert-to-transfer candidate search.
#[derive(Debug, Deserialize)]
pub struct ConvertCandidatesQuery {
    /// The counterpart account to search within.
    pub account_id: Uuid,
    /// Optional text search (title or notes). When omitted, returns suggestions
    /// (opposite sign, exact amount, within plus or minus one day). When
    /// present, searches the whole account with the window relaxed.
    pub search: Option<String>,
}

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

/// List candidate transactions to link when converting a transaction into a
/// transfer.
/// GET /transactions/:id/convert-candidates?account_id=..&search=..
pub async fn convert_candidates(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(transaction_id): Path<Uuid>,
    Query(query): Query<ConvertCandidatesQuery>,
) -> Result<Json<Vec<TransferCandidate>>, ApiError> {
    let user_id = auth_context.user_id();
    let candidates = transfer_service::find_convert_candidates(
        &state.db,
        user_id,
        transaction_id,
        query.account_id,
        query.search,
    )
    .await?;

    Ok(Json(candidates))
}
