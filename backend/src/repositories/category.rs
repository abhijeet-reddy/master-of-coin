use diesel::prelude::*;
use uuid::Uuid;

use crate::{
    DbPool,
    errors::ApiError,
    models::category::{Category, NewCategory, UpdateCategory},
    schema::categories,
};

/// Create a new category
pub async fn create_category(
    pool: &DbPool,
    user_id: Uuid,
    new_category: NewCategory,
) -> Result<Category, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::insert_into(categories::table)
            .values(&new_category)
            .get_result(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to create category for user {}: {}", user_id, e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Find category by ID
pub async fn find_by_id(pool: &DbPool, category_id: Uuid) -> Result<Category, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        categories::table
            .find(category_id)
            .first(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to find category by id {}: {}", category_id, e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// List all categories for a user
pub async fn list_by_user(pool: &DbPool, user_id: Uuid) -> Result<Vec<Category>, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        categories::table
            .filter(categories::user_id.eq(user_id))
            .order(categories::name.asc())
            .load(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to list categories for user {}: {}", user_id, e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Update category
pub async fn update_category(
    pool: &DbPool,
    category_id: Uuid,
    updates: UpdateCategory,
) -> Result<Category, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        // Apply updates one at a time
        if let Some(name) = updates.name {
            diesel::update(categories::table.find(category_id))
                .set(categories::name.eq(name))
                .execute(&mut conn)
                .map_err(|e| {
                    tracing::error!("Failed to update category name {}: {}", category_id, e);
                    ApiError::from(e)
                })?;
        }
        if let Some(icon) = updates.icon {
            diesel::update(categories::table.find(category_id))
                .set(categories::icon.eq(icon))
                .execute(&mut conn)
                .map_err(|e| {
                    tracing::error!("Failed to update category icon {}: {}", category_id, e);
                    ApiError::from(e)
                })?;
        }
        if let Some(color) = updates.color {
            diesel::update(categories::table.find(category_id))
                .set(categories::color.eq(color))
                .execute(&mut conn)
                .map_err(|e| {
                    tracing::error!("Failed to update category color {}: {}", category_id, e);
                    ApiError::from(e)
                })?;
        }
        if let Some(parent_category_id) = updates.parent_category_id {
            diesel::update(categories::table.find(category_id))
                .set(categories::parent_category_id.eq(parent_category_id))
                .execute(&mut conn)
                .map_err(|e| {
                    tracing::error!(
                        "Failed to update category parent_category_id {}: {}",
                        category_id,
                        e
                    );
                    ApiError::from(e)
                })?;
        }

        // Return the updated category
        categories::table
            .find(category_id)
            .first(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to fetch updated category {}: {}", category_id, e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Delete category
pub async fn delete_category(pool: &DbPool, category_id: Uuid) -> Result<(), ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::delete(categories::table.find(category_id))
            .execute(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to delete category {}: {}", category_id, e);
                ApiError::from(e)
            })
            .map(|_| ())
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}
