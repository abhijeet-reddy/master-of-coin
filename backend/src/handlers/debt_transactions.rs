//! HTTP handlers for debt transaction endpoints.

use crate::{
    AppState,
    auth::context::AuthContext,
    errors::ApiError,
    models::{
        CreateDebtTransactionRequest, TransactionResponse,
        debt_transaction_metadata::UpdateExpenseDetailsRequest,
    },
    services::{debt_transaction_service, split_sync_service::SplitSyncService},
};
use axum::{
    Json,
    extract::{Extension, Path, State},
    http::StatusCode,
};
use uuid::Uuid;

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

    // Auto-sync to Splitwise if the payer person has a split provider configured
    trigger_split_sync(state.split_sync.clone(), response.id).await;

    Ok((StatusCode::CREATED, Json(response)))
}

/// Trigger split sync for a debt transaction in the background.
/// Non-blocking — errors are logged but don't fail the request.
async fn trigger_split_sync(sync_service: Option<SplitSyncService>, transaction_id: Uuid) {
    if let Some(service) = sync_service {
        match service.sync_transaction(transaction_id).await {
            Ok(result) => {
                let status = result
                    .get("status")
                    .and_then(|s| s.as_str())
                    .unwrap_or("unknown");
                tracing::info!(
                    "Debt transaction {} auto-sync result: {}",
                    transaction_id,
                    status
                );
            }
            Err(e) => {
                // Non-fatal: sync can be retried manually
                tracing::warn!(
                    "Debt transaction {} auto-sync failed (can retry manually): {}",
                    transaction_id,
                    e
                );
            }
        }
    }
}

/// Update expense details (total_cost, expense_participants) on a debt transaction.
/// PUT /api/v1/debt-transactions/:transaction_id/metadata
pub async fn update_metadata(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(transaction_id): Path<Uuid>,
    Json(request): Json<UpdateExpenseDetailsRequest>,
) -> Result<Json<TransactionResponse>, ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!(
        "Updating expense details for debt transaction {} (user {})",
        transaction_id,
        user_id
    );

    let response = debt_transaction_service::update_expense_details(
        &state.db,
        user_id,
        transaction_id,
        request,
    )
    .await?;

    Ok(Json(response))
}
