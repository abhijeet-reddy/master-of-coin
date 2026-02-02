use crate::{
    AppState,
    auth::context::AuthContext,
    errors::ApiError,
    models::{BudgetResponse, CreateBudgetRangeRequest, CreateBudgetRequest, UpdateBudgetRequest},
    services::budget_service,
};
use axum::{
    Json,
    extract::{Extension, Path, State},
    http::StatusCode,
};
use uuid::Uuid;

/// List all budgets for the authenticated user
/// GET /budgets
pub async fn list(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
) -> Result<Json<Vec<BudgetResponse>>, ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!("Listing budgets for user {}", user_id);

    let budgets = budget_service::list_budgets(&state.db, user_id).await?;

    Ok(Json(budgets))
}

/// Create a new budget
/// POST /budgets
pub async fn create(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Json(request): Json<CreateBudgetRequest>,
) -> Result<(StatusCode, Json<BudgetResponse>), ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!("Creating budget for user {}", user_id);

    let budget = budget_service::create_budget(&state.db, user_id, request).await?;

    Ok((StatusCode::CREATED, Json(budget)))
}

/// Get a single budget by ID
/// GET /budgets/:id
pub async fn get(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(id): Path<Uuid>,
) -> Result<Json<BudgetResponse>, ApiError> {
    let user_id = auth_context.user_id();
    tracing::debug!("Fetching budget {} for user {}", id, user_id);

    let budget = budget_service::get_budget(&state.db, id, user_id).await?;

    Ok(Json(budget))
}

/// Update a budget
/// PUT /budgets/:id
pub async fn update(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateBudgetRequest>,
) -> Result<Json<BudgetResponse>, ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!("Updating budget {} for user {}", id, user_id);

    let budget = budget_service::update_budget(&state.db, id, user_id, request).await?;

    Ok(Json(budget))
}

/// Delete a budget
/// DELETE /budgets/:id
pub async fn delete(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!("Deleting budget {} for user {}", id, user_id);

    budget_service::delete_budget(&state.db, id, user_id).await?;

    Ok(StatusCode::NO_CONTENT)
}

/// Add a budget range to a budget
/// POST /budgets/:id/ranges
pub async fn add_range(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(budget_id): Path<Uuid>,
    Json(request): Json<CreateBudgetRangeRequest>,
) -> Result<(StatusCode, Json<crate::models::BudgetRangeResponse>), ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!("Adding range to budget {} for user {}", budget_id, user_id);

    let range = budget_service::add_range(&state.db, budget_id, user_id, request).await?;

    Ok((StatusCode::CREATED, Json(range)))
}
