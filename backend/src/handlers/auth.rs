use crate::{
    AppState,
    auth::context::AuthContext,
    errors::ApiError,
    models::{AuthResponse, CreateUserRequest, LoginRequest, UserResponse},
    services::auth_service,
};
use axum::{
    Json,
    extract::{Extension, State},
    http::StatusCode,
};

/// Register a new user
/// POST /auth/register
pub async fn register(
    State(state): State<AppState>,
    Json(request): Json<CreateUserRequest>,
) -> Result<(StatusCode, Json<AuthResponse>), ApiError> {
    tracing::info!("Registering new user: {}", request.username);

    let response = auth_service::register(&state.db, &state.config.jwt, request).await?;

    Ok((StatusCode::CREATED, Json(response)))
}

/// Login with username/email and password
/// POST /auth/login
pub async fn login(
    State(state): State<AppState>,
    Json(request): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, ApiError> {
    tracing::info!("Login attempt for: {}", request.email);

    let response = auth_service::login(&state.db, &state.config.jwt, request).await?;

    Ok(Json(response))
}

/// Get current authenticated user
/// GET /auth/me
pub async fn get_current_user(
    Extension(auth_context): Extension<AuthContext>,
) -> Result<Json<UserResponse>, ApiError> {
    let user = auth_context.user();
    tracing::debug!("Fetching current user: {}", user.id);

    Ok(Json(UserResponse {
        id: user.id,
        username: user.username.clone(),
        email: user.email.clone(),
        name: user.name.clone(),
        created_at: user.created_at,
    }))
}
