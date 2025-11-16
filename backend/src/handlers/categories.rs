use crate::{
    AppState,
    errors::ApiError,
    models::{CategoryResponse, CreateCategoryRequest, UpdateCategoryRequest, User},
    repositories,
};
use axum::{
    Json,
    extract::{Extension, Path, State},
    http::StatusCode,
};
use uuid::Uuid;
use validator::Validate;

/// List all categories for the authenticated user
/// GET /categories
pub async fn list(
    State(state): State<AppState>,
    Extension(user): Extension<User>,
) -> Result<Json<Vec<CategoryResponse>>, ApiError> {
    tracing::info!("Listing categories for user {}", user.id);

    let categories = repositories::category::list_by_user(&state.db, user.id).await?;

    let responses: Vec<CategoryResponse> =
        categories.into_iter().map(CategoryResponse::from).collect();

    Ok(Json(responses))
}

/// Create a new category
/// POST /categories
pub async fn create(
    State(state): State<AppState>,
    Extension(user): Extension<User>,
    Json(request): Json<CreateCategoryRequest>,
) -> Result<(StatusCode, Json<CategoryResponse>), ApiError> {
    tracing::info!("Creating category for user {}", user.id);

    // Validate request
    request
        .validate()
        .map_err(|e| ApiError::Validation(format!("Validation failed: {}", e)))?;

    let new_category: crate::models::NewCategory = crate::models::NewCategory {
        user_id: user.id,
        name: request.name,
        color: request.color,
        icon: request.icon,
        parent_id: request.parent_id,
    };

    let category =
        repositories::category::create_category(&state.db, user.id, new_category).await?;

    Ok((StatusCode::CREATED, Json(category.into())))
}

/// Update a category
/// PUT /categories/:id
pub async fn update(
    State(state): State<AppState>,
    Extension(user): Extension<User>,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateCategoryRequest>,
) -> Result<Json<CategoryResponse>, ApiError> {
    tracing::info!("Updating category {} for user {}", id, user.id);

    // Validate request
    request
        .validate()
        .map_err(|e| ApiError::Validation(format!("Validation failed: {}", e)))?;

    // Verify ownership
    let category = repositories::category::find_by_id(&state.db, id).await?;
    if category.user_id != user.id {
        return Err(ApiError::Forbidden(
            "Category does not belong to user".to_string(),
        ));
    }

    let updates = crate::models::UpdateCategory {
        name: request.name,
        color: request.color,
        icon: request.icon,
        parent_id: None,
    };

    let updated_category = repositories::category::update_category(&state.db, id, updates).await?;

    Ok(Json(updated_category.into()))
}

/// Delete a category
/// DELETE /categories/:id
pub async fn delete(
    State(state): State<AppState>,
    Extension(user): Extension<User>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    tracing::info!("Deleting category {} for user {}", id, user.id);

    // Verify ownership
    let category = repositories::category::find_by_id(&state.db, id).await?;
    if category.user_id != user.id {
        return Err(ApiError::Forbidden(
            "Category does not belong to user".to_string(),
        ));
    }

    repositories::category::delete_category(&state.db, id).await?;

    Ok(StatusCode::NO_CONTENT)
}
