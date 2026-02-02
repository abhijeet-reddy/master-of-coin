use crate::{
    AppState,
    auth::context::AuthContext,
    errors::ApiError,
    models::{AccountResponse, CreateAccountRequest, UpdateAccountRequest},
    services::account_service,
};
use axum::{
    Json,
    extract::{Extension, Path, State},
    http::StatusCode,
};
use uuid::Uuid;

/// List all accounts for the authenticated user
/// GET /accounts
pub async fn list(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
) -> Result<Json<Vec<AccountResponse>>, ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!("Listing accounts for user {}", user_id);

    let accounts = account_service::list_accounts(&state.db, user_id).await?;

    Ok(Json(accounts))
}

/// Create a new account
/// POST /accounts
pub async fn create(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Json(request): Json<CreateAccountRequest>,
) -> Result<(StatusCode, Json<AccountResponse>), ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!("Creating account for user {}", user_id);

    let account = account_service::create_account(&state.db, user_id, request).await?;

    Ok((StatusCode::CREATED, Json(account)))
}

/// Get a single account by ID
/// GET /accounts/:id
pub async fn get(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(id): Path<Uuid>,
) -> Result<Json<AccountResponse>, ApiError> {
    let user_id = auth_context.user_id();
    tracing::debug!("Fetching account {} for user {}", id, user_id);

    let account = account_service::get_account(&state.db, id, user_id).await?;

    Ok(Json(account))
}

/// Update an account
/// PUT /accounts/:id
pub async fn update(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateAccountRequest>,
) -> Result<Json<AccountResponse>, ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!("Updating account {} for user {}", id, user_id);

    let account = account_service::update_account(&state.db, id, user_id, request).await?;

    Ok(Json(account))
}

/// Delete an account
/// DELETE /accounts/:id
pub async fn delete(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!("Deleting account {} for user {}", id, user_id);

    account_service::delete_account(&state.db, id, user_id).await?;

    Ok(StatusCode::NO_CONTENT)
}
