use crate::{
    AppState,
    auth::context::AuthContext,
    errors::ApiError,
    services::analytics_service::{self, DashboardSummary},
};
use axum::{
    Json,
    extract::{Extension, State},
};

/// Get dashboard summary for the authenticated user
/// GET /dashboard
pub async fn get_summary(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
) -> Result<Json<DashboardSummary>, ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!("Fetching dashboard summary for user {}", user_id);

    let summary = analytics_service::get_dashboard_summary(&state.db, user_id).await?;

    Ok(Json(summary))
}
