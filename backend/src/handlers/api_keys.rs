use crate::{
    AppState,
    auth::context::AuthContext,
    errors::ApiError,
    models::{
        ApiKeyResponse, CreateApiKeyRequest, CreateApiKeyResponse, ListApiKeysResponse,
        UpdateApiKeyRequest,
    },
    services::api_key_service,
};
use axum::{
    Json,
    extract::{Extension, Path, State},
    http::StatusCode,
};
use uuid::Uuid;

/// Create a new API key
/// POST /api-keys
pub async fn create(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Json(request): Json<CreateApiKeyRequest>,
) -> Result<(StatusCode, Json<CreateApiKeyResponse>), ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!("Creating API key for user {}", user_id);

    let response = api_key_service::create_api_key(&state.db, user_id, request).await?;

    Ok((StatusCode::CREATED, Json(response)))
}

/// List all API keys for the authenticated user
/// GET /api-keys
pub async fn list(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
) -> Result<Json<ListApiKeysResponse>, ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!("Listing API keys for user {}", user_id);

    let response = api_key_service::list_api_keys(&state.db, user_id).await?;

    Ok(Json(response))
}

/// Get a single API key by ID
/// GET /api-keys/:id
pub async fn get(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiKeyResponse>, ApiError> {
    let user_id = auth_context.user_id();
    tracing::debug!("Fetching API key {} for user {}", id, user_id);

    let response = api_key_service::get_api_key(&state.db, user_id, id).await?;

    Ok(Json(response))
}

/// Update an API key
/// PATCH /api-keys/:id
pub async fn update(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateApiKeyRequest>,
) -> Result<Json<ApiKeyResponse>, ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!("Updating API key {} for user {}", id, user_id);

    let response = api_key_service::update_api_key(&state.db, user_id, id, request).await?;

    Ok(Json(response))
}

/// Revoke an API key
/// DELETE /api-keys/:id
pub async fn revoke(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!("Revoking API key {} for user {}", id, user_id);

    api_key_service::revoke_api_key(&state.db, user_id, id).await?;

    Ok(StatusCode::NO_CONTENT)
}
