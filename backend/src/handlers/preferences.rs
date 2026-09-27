use axum::{
    Json,
    extract::{Extension, State},
};

use crate::{
    AppState,
    auth::context::AuthContext,
    errors::ApiError,
    models::user_preferences::{UpdateUserPreferencesRequest, UserPreferencesResponse},
    services::preferences_service,
};

/// Read preferences (defaults when never saved)
/// GET /preferences
pub async fn get(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
) -> Result<Json<UserPreferencesResponse>, ApiError> {
    let prefs = preferences_service::get_preferences(&state.db, auth_context.user_id()).await?;
    Ok(Json(prefs))
}

/// Save preferences (upsert)
/// PUT /preferences
pub async fn update(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Json(request): Json<UpdateUserPreferencesRequest>,
) -> Result<Json<UserPreferencesResponse>, ApiError> {
    auth_context.require_session()?;
    let prefs =
        preferences_service::update_preferences(&state.db, auth_context.user_id(), request).await?;
    Ok(Json(prefs))
}
