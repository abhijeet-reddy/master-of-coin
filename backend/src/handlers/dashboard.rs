use crate::{
    AppState,
    errors::ApiError,
    models::User,
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
    Extension(user): Extension<User>,
) -> Result<Json<DashboardSummary>, ApiError> {
    tracing::info!("Fetching dashboard summary for user {}", user.id);

    let summary = analytics_service::get_dashboard_summary(&state.db, user.id).await?;

    Ok(Json(summary))
}
