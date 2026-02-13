use crate::{
    DbPool,
    errors::ApiError,
    models::{NewSplitProvider, SplitProvider},
    schema::split_providers,
};
use diesel::prelude::*;
use uuid::Uuid;

/// Find a split provider by ID
pub async fn find_by_id(pool: &DbPool, id: Uuid) -> Result<Option<SplitProvider>, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::InternalWithMessage("Failed to get database connection".to_string())
    })?;

    tokio::task::spawn_blocking(move || {
        split_providers::table
            .find(id)
            .first::<SplitProvider>(&mut conn)
            .optional()
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::InternalWithMessage("Task execution error".to_string())
    })?
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        ApiError::from(e)
    })
}

/// Find a split provider by user ID and provider type
pub async fn find_by_user_and_type(
    pool: &DbPool,
    user_id: Uuid,
    provider_type: &str,
) -> Result<Option<SplitProvider>, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::InternalWithMessage("Failed to get database connection".to_string())
    })?;

    let provider_type = provider_type.to_string();

    tokio::task::spawn_blocking(move || {
        split_providers::table
            .filter(split_providers::user_id.eq(user_id))
            .filter(split_providers::provider_type.eq(provider_type))
            .first::<SplitProvider>(&mut conn)
            .optional()
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::InternalWithMessage("Task execution error".to_string())
    })?
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        ApiError::from(e)
    })
}

/// List all split providers for a user
pub async fn list_by_user(pool: &DbPool, user_id: Uuid) -> Result<Vec<SplitProvider>, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::InternalWithMessage("Failed to get database connection".to_string())
    })?;

    tokio::task::spawn_blocking(move || {
        split_providers::table
            .filter(split_providers::user_id.eq(user_id))
            .order(split_providers::created_at.desc())
            .load::<SplitProvider>(&mut conn)
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::InternalWithMessage("Task execution error".to_string())
    })?
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        ApiError::from(e)
    })
}

/// Create or update a split provider (upsert)
pub async fn upsert_provider(
    pool: &DbPool,
    user_id: Uuid,
    new_provider: NewSplitProvider,
) -> Result<SplitProvider, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::InternalWithMessage("Failed to get database connection".to_string())
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::insert_into(split_providers::table)
            .values(&new_provider)
            .on_conflict((split_providers::user_id, split_providers::provider_type))
            .do_update()
            .set((
                split_providers::credentials.eq(&new_provider.credentials),
                split_providers::is_active.eq(&new_provider.is_active),
                split_providers::updated_at.eq(diesel::dsl::now),
            ))
            .get_result::<SplitProvider>(&mut conn)
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::InternalWithMessage("Task execution error".to_string())
    })?
    .map_err(|e| {
        tracing::error!("Failed to upsert provider for user {}: {}", user_id, e);
        ApiError::from(e)
    })
}

/// Delete a split provider
pub async fn delete_provider(pool: &DbPool, id: Uuid, user_id: Uuid) -> Result<(), ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::InternalWithMessage("Failed to get database connection".to_string())
    })?;

    let deleted = tokio::task::spawn_blocking(move || {
        diesel::delete(
            split_providers::table
                .filter(split_providers::id.eq(id))
                .filter(split_providers::user_id.eq(user_id)),
        )
        .execute(&mut conn)
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::InternalWithMessage("Task execution error".to_string())
    })?
    .map_err(|e| {
        tracing::error!("Failed to delete provider {}: {}", id, e);
        ApiError::from(e)
    })?;

    if deleted == 0 {
        return Err(ApiError::NotFound("Provider not found".to_string()));
    }

    Ok(())
}

/// Update provider active status
pub async fn update_active_status(
    pool: &DbPool,
    id: Uuid,
    user_id: Uuid,
    is_active: bool,
) -> Result<SplitProvider, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::InternalWithMessage("Failed to get database connection".to_string())
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::update(
            split_providers::table
                .filter(split_providers::id.eq(id))
                .filter(split_providers::user_id.eq(user_id)),
        )
        .set((
            split_providers::is_active.eq(is_active),
            split_providers::updated_at.eq(diesel::dsl::now),
        ))
        .get_result::<SplitProvider>(&mut conn)
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::InternalWithMessage("Task execution error".to_string())
    })?
    .map_err(|e| {
        tracing::error!("Failed to update provider {} status: {}", id, e);
        ApiError::from(e)
    })
}
