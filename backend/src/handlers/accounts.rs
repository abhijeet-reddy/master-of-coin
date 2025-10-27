use crate::{
    AppState,
    errors::ApiError,
    models::{AccountResponse, CreateAccountRequest, UpdateAccountRequest, User},
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
    Extension(user): Extension<User>,
) -> Result<Json<Vec<AccountResponse>>, ApiError> {
    tracing::info!("Listing accounts for user {}", user.id);

    let accounts = account_service::list_accounts(&state.db, user.id).await?;

    Ok(Json(accounts))
}

/// Create a new account
/// POST /accounts
pub async fn create(
    State(state): State<AppState>,
    Extension(user): Extension<User>,
    Json(request): Json<CreateAccountRequest>,
) -> Result<(StatusCode, Json<AccountResponse>), ApiError> {
    tracing::info!("Creating account for user {}", user.id);

    let account = account_service::create_account(&state.db, user.id, request).await?;

    Ok((StatusCode::CREATED, Json(account)))
}

/// Get a single account by ID
/// GET /accounts/:id
pub async fn get(
    State(state): State<AppState>,
    Extension(user): Extension<User>,
    Path(id): Path<Uuid>,
) -> Result<Json<AccountResponse>, ApiError> {
    tracing::debug!("Fetching account {} for user {}", id, user.id);

    let account = account_service::get_account(&state.db, id, user.id).await?;

    Ok(Json(account))
}

/// Update an account
/// PUT /accounts/:id
pub async fn update(
    State(state): State<AppState>,
    Extension(user): Extension<User>,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateAccountRequest>,
) -> Result<Json<AccountResponse>, ApiError> {
    tracing::info!("Updating account {} for user {}", id, user.id);

    let account = account_service::update_account(&state.db, id, user.id, request).await?;

    Ok(Json(account))
}

/// Delete an account
/// DELETE /accounts/:id
pub async fn delete(
    State(state): State<AppState>,
    Extension(user): Extension<User>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    tracing::info!("Deleting account {} for user {}", id, user.id);

    account_service::delete_account(&state.db, id, user.id).await?;

    Ok(StatusCode::NO_CONTENT)
}
